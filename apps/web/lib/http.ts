import type { ApiError } from '@cb/shared';
import { unstable_rethrow } from 'next/navigation';
import type { z } from 'zod';

/** `{ error, code }` JSON error response (ARCHITECTURE §4). */
export function errorResponse(status: number, error: string, code: string): Response {
  return Response.json({ error, code } satisfies ApiError, { status });
}

export function notImplemented(): Response {
  return errorResponse(501, 'not implemented', 'TODO');
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

function invalid(error: z.ZodError): Response {
  const msg = error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  return errorResponse(400, msg, 'INVALID_INPUT');
}

/** Validate a JSON body with a shared zod schema. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: errorResponse(400, 'body must be JSON', 'INVALID_JSON') };
  }
  const r = schema.safeParse(json);
  return r.success ? { ok: true, data: r.data } : { ok: false, response: invalid(r.error) };
}

/** Validate query params (or route params) with a shared zod schema. */
export function parseObject<S extends z.ZodType>(value: unknown, schema: S): Parsed<z.infer<S>> {
  const r = schema.safeParse(value);
  return r.success ? { ok: true, data: r.data } : { ok: false, response: invalid(r.error) };
}

export function queryObject(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}

/** Wrap a handler so thrown errors become `{ error, code }` 500s (and missing env a clear 503). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      // Let Next.js internals (dynamic-rendering bail-outs, notFound, redirect) through.
      unstable_rethrow(err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('Missing or invalid env vars')) return errorResponse(503, message, 'NOT_CONFIGURED');
      console.error('[api]', err);
      return errorResponse(500, 'internal error', 'INTERNAL');
    }
  };
}
