// Server only.
/**
 * Hackathon-grade rate limits (ARCHITECTURE §7): in-memory per instance plus DB counts.
 */
export const LIMITS = {
  signup: { limit: 5, windowMs: 60_000 }, // per IP
  join: { limit: 10, windowMs: 60_000 }, // per rider
  startRun: { limit: 1, windowMs: 3_000 }, // per rider
  redeem: { limit: 10, windowMs: 60_000 }, // per kiosk
} as const;
export type LimitName = keyof typeof LIMITS;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

/** TODO: sliding-window counter keyed by `${name}:${key}`. Always allows for now. */
export function rateLimit(_name: LimitName, _key: string): RateLimitResult {
  return { ok: true };
}
