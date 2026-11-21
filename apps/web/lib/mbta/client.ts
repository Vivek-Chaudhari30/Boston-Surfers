/**
 * Minimal MBTA V3 API client (https://api-v3.mbta.com). Server and scripts only:
 * the API key must never reach the browser.
 */
import { ROUTE_IDS } from '@cb/shared';
import type { MbtaVehiclesResponse } from './placement';

export const MBTA_BASE_URL = 'https://api-v3.mbta.com';

export class MbtaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function mbtaGet<T>(
  path: string,
  params: Record<string, string>,
  opts: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const url = new URL(path, MBTA_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: 'application/vnd.api+json' };
  if (opts.apiKey) headers['x-api-key'] = opts.apiKey;
  const res = await fetch(url, { headers, signal: opts.signal, cache: 'no-store' });
  if (!res.ok) throw new MbtaError(`MBTA ${path} → HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** All in-scope vehicles with their stop included (for parent-station mapping). */
export function fetchVehicles(opts: { apiKey?: string; signal?: AbortSignal } = {}): Promise<MbtaVehiclesResponse> {
  return mbtaGet<MbtaVehiclesResponse>(
    '/vehicles',
    { 'filter[route]': ROUTE_IDS.join(','), include: 'stop' },
    opts,
  );
}
