// Server only: never import from a client component.
import { z } from 'zod';

/**
 * Server env, read lazily so pages that don't need it (/dev/*) build and run with no .env.local.
 * Call serverEnv() inside handlers, never at module top level.
 */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MBTA_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  KIOSK_SECRET: z.string().min(4), // short is OK for the demo; it only guards kiosk endpoints
  NEXT_PUBLIC_APP_URL: z.url(),
  PRIZE_MIN_RIDERS: z.coerce.number().int().nonnegative().default(1),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid env vars: ${missing}. Copy .env.example to apps/web/.env.local.`);
  }
  cached = parsed.data;
  return cached;
}
