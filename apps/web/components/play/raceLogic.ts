import type { LiveRacer, RacePosMsg } from '@/lib/race';

/** Ignore countdown corrections smaller than this (the kiosk broadcasts once a second, with network jitter). */
export const GO_AT_JITTER_MS = 400;

/** Local GO time: keep the previous one unless the kiosk's countdown disagrees by more than the jitter. */
export function nextGoAt(prev: number | null, now: number, msLeft: number): number {
  const next = now + msLeft;
  return prev === null || Math.abs(next - prev) > GO_AT_JITTER_MS ? next : prev;
}

/** Throttle for live score broadcasts. `force` (final results) always sends. */
export function shouldSendPos(lastSentAt: number, now: number, everyMs: number, force = false): boolean {
  return force || now - lastSentAt >= everyMs;
}

/**
 * Fold a position message into the live racer map (returns a new map).
 * A racer who is out stays out: a late "alive" message never revives them or lowers a final score.
 */
export function mergeRacer(prev: ReadonlyMap<string, LiveRacer>, msg: RacePosMsg, now: number): Map<string, LiveRacer> {
  const next = new Map(prev);
  const cur = prev.get(msg.riderId);
  if (cur && !cur.alive) {
    next.set(msg.riderId, { ...cur, seenAt: now });
    return next;
  }
  next.set(msg.riderId, { riderId: msg.riderId, name: msg.name, score: msg.score, alive: msg.alive, seenAt: now });
  return next;
}

export function medal(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}`;
}
