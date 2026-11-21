// Server only.
/**
 * Hackathon-grade rate limits (ARCHITECTURE §7): in-memory sliding window per instance.
 * Fluid Compute reuses instances, so this catches bursts; it is not a global guarantee.
 */
export const LIMITS = {
  signup: { limit: 5, windowMs: 60_000 }, // per IP
  join: { limit: 10, windowMs: 60_000 }, // per rider
  startRun: { limit: 1, windowMs: 3_000 }, // per rider
  redeem: { limit: 10, windowMs: 60_000 }, // per kiosk
} as const;
export type LimitName = keyof typeof LIMITS;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

const hits = new Map<string, number[]>();

export function rateLimit(name: LimitName, key: string, now: number = Date.now()): RateLimitResult {
  const { limit, windowMs } = LIMITS[name];
  const k = `${name}:${key}`;
  const recent = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(k, recent);
    return { ok: false, retryAfterMs: windowMs - (now - recent[0]!) };
  }
  recent.push(now);
  hits.set(k, recent);
  if (hits.size > 10_000) hits.clear(); // crude memory cap
  return { ok: true };
}

export function resetRateLimits() {
  hits.clear();
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
