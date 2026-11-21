/**
 * Car Race: every train car is a live multiplayer room (Supabase Realtime, channel `race:<carId>`).
 *
 * - Phones on /play/race join Presence with { riderId, name }. Being on that page = ready.
 * - The kiosk is the host. It runs the state machine and broadcasts `race` state every second.
 * - Phones broadcast `pos` (live score) while running. Live positions are cosmetic HINTS.
 * - The official podium comes from the API (GET /api/cars/:carId/race?since=…), never from payloads.
 * - Each race run is an ordinary /api/runs run, so validation, car board and stickers are unchanged.
 *
 * Kept inside apps/web on purpose: no change to the frozen @cb/shared api.ts contract or the DB.
 */
import { z } from 'zod';

export const raceChannel = (carId: string) => `race:${carId}` as const;

/** Broadcast event names on the race channel. */
export const RACE_EVENTS = { state: 'race', pos: 'pos' } as const;

export const RACE = {
  /** Countdown after the first rider is ready; more riders can join during it. */
  COUNTDOWN_MS: 15_000,
  /** Hard stop for a race even if someone is still running. */
  MAX_MS: 180_000,
  /** A racer with no position update for this long counts as out. */
  STALE_MS: 20_000,
  /** How long the podium stays up. */
  RESULTS_MS: 15_000,
  /** Phones send their live score at most this often. */
  POS_EVERY_MS: 500,
  /** Server window: race runs are the ones started within [startAt - before, startAt + after]. */
  WINDOW_BEFORE_MS: 5_000,
  WINDOW_AFTER_MS: 30_000,
} as const;

const RaceId = z.string().min(4).max(32);
const Seed = z.number().int().nonnegative().max(2 ** 31);
const Name = z.string().min(1).max(40);

export const RaceStanding = z.object({ riderId: z.string().uuid(), displayName: Name, score: z.number().int().nonnegative() });
export type RaceStanding = z.infer<typeof RaceStanding>;

export const RaceStateMsg = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('idle') }),
  z.object({ phase: z.literal('countdown'), raceId: RaceId, seed: Seed, msLeft: z.number().int().min(0).max(60_000) }),
  z.object({ phase: z.literal('running'), raceId: RaceId, seed: Seed, msElapsed: z.number().int().min(0) }),
  z.object({ phase: z.literal('results'), raceId: RaceId, standings: z.array(RaceStanding).max(50) }),
]);
export type RaceStateMsg = z.infer<typeof RaceStateMsg>;

export const RacePosMsg = z.object({
  raceId: RaceId,
  riderId: z.string().uuid(),
  name: Name,
  score: z.number().int().nonnegative().max(10_000_000),
  alive: z.boolean(),
});
export type RacePosMsg = z.infer<typeof RacePosMsg>;

export const RacePresence = z.object({ riderId: z.string().uuid(), name: Name });
export type RacePresence = z.infer<typeof RacePresence>;

/** GET /api/cars/:carId/race?since=<ISO>&riders=<id,id> (kiosk) */
export const RaceResultsResponse = z.object({ standings: z.array(RaceStanding) });
export type RaceResultsResponse = z.infer<typeof RaceResultsResponse>;

export type LiveRacer = { riderId: string; name: string; score: number; alive: boolean; seenAt: number };

/** Live order: highest score first; ties keep the racer who is still alive on top. */
export function liveOrder(racers: Iterable<LiveRacer>): LiveRacer[] {
  return [...racers].sort((a, b) => b.score - a.score || Number(b.alive) - Number(a.alive) || a.name.localeCompare(b.name));
}

/** A racer is out once they crashed or went quiet for STALE_MS. */
export function isOut(r: LiveRacer, now: number): boolean {
  return !r.alive || now - r.seenAt > RACE.STALE_MS;
}

/**
 * Should the host end the race now? Past MAX_MS, or every participant is out
 * (a participant who never sent a position counts as out after STALE_MS).
 */
export function shouldEndRace(opts: { participants: string[]; racers: Map<string, LiveRacer>; startedAt: number; now: number }): boolean {
  const { participants, racers, startedAt, now } = opts;
  if (now - startedAt >= RACE.MAX_MS) return true;
  if (participants.length === 0) return now - startedAt > RACE.STALE_MS;
  return participants.every((id) => {
    const r = racers.get(id);
    if (!r) return now - startedAt > RACE.STALE_MS;
    return isOut(r, now);
  });
}

/** Official podium from finished runs: best score per rider, only race participants, highest first. */
export function podiumFromRuns(
  runs: { rider_id: string; score: number | null }[],
  names: Map<string, string>,
  participants: Set<string> | null,
): RaceStanding[] {
  const best = new Map<string, number>();
  for (const r of runs) {
    if (r.score == null) continue;
    if (participants && !participants.has(r.rider_id)) continue;
    best.set(r.rider_id, Math.max(best.get(r.rider_id) ?? 0, r.score));
  }
  return [...best.entries()]
    .map(([riderId, score]) => ({ riderId, displayName: names.get(riderId) ?? 'Rider', score }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}

export function newRaceId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(4, '0');
}

export function newRaceSeed(): number {
  return Math.floor(Math.random() * (2 ** 31 - 1));
}

/** Query for GET /api/cars/:carId/race. `riders` is a comma-separated list of rider uuids (max 50). */
export const RaceQuery = z.object({
  since: z.string().datetime({ offset: true }),
  riders: z
    .string()
    .max(50 * 37)
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null))
    .pipe(z.array(z.string().uuid()).max(50).nullable()),
});
export type RaceQuery = z.infer<typeof RaceQuery>;

/** ISO bounds of the server window for runs belonging to a race that started at `sinceIso`. */
export function raceWindow(sinceIso: string): { from: string; to: string } {
  const t = Date.parse(sinceIso);
  return { from: new Date(t - RACE.WINDOW_BEFORE_MS).toISOString(), to: new Date(t + RACE.WINDOW_AFTER_MS).toISOString() };
}
