'use client';
/**
 * Typed browser fetch helpers for our own API. Responses are validated with the shared zod schemas.
 * Errors throw ApiClientError with the server's `{ error, code }`.
 */
import { ApiError, KIOSK_KEY_HEADER } from '@cb/shared';
import type { z } from 'zod';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<S extends z.ZodType>(
  path: string,
  schema: S,
  init: { method?: 'GET' | 'POST'; body?: unknown; kioskKey?: string; signal?: AbortSignal } = {},
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.kioskKey) headers[KIOSK_KEY_HEADER] = init.kioskKey;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiClientError('No connection. Check your signal and try again.', 'NETWORK', 0);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = ApiError.safeParse(json);
    throw new ApiClientError(e.success ? e.data.error : `HTTP ${res.status}`, e.success ? e.data.code : 'HTTP', res.status);
  }
  return schema.parse(json);
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** "617 555 1234" / "(617) 555-1234" / "+44 20…" → E.164. US numbers get +1. */
export function toE164(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}
