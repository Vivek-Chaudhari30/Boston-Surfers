// Server only. Grants awards idempotently (dedupe_key unique). Every grant is best-effort:
// a failure is logged and never breaks the request that triggered it.
import { db } from './db';
import { bostonDate } from './time';
import { shiftDay } from './day';
import { ORDINAL, dailyWinners, dedupe, milestoneOffers, milestonesReached, racePodium, type AwardTypeId } from './awards-logic';

type Grant = {
  rider_id: string;
  type_id: AwardTypeId;
  dedupe_key: string;
  title: string;
  rank?: number | null;
  score?: number | null;
  car_id?: string | null;
  ride_id?: string | null;
  run_id?: string | null;
  claim_id?: string | null;
  day?: string | null;
  meta?: Record<string, unknown>;
  won_at?: string;
};

export async function grant(rows: Grant[]): Promise<number> {
  if (!rows.length) return 0;
  try {
    const { data, error } = await db()
      .from('awards')
      .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  } catch (err) {
    console.warn('[awards] grant failed', err);
    return 0;
  }
}

/** Rider left the train as #1 of the car: the voucher claim is the award. */
export function grantCarChampion(o: { riderId: string; carId: string; rideId: string; claimId: string; score: number }) {
  return grant([
    {
      rider_id: o.riderId,
      type_id: 'car_champion',
      dedupe_key: dedupe.carChampion(o.claimId),
      title: `Car champion · ${o.carId}`,
      rank: 1,
      score: o.score,
      car_id: o.carId,
      ride_id: o.rideId,
      claim_id: o.claimId,
    },
  ]);
}

/** Accepted run: one award per milestone tier per rider, ever. */
export function grantMilestones(o: { riderId: string; carId: string; runId: string; score: number }) {
  return grant(
    milestonesReached(o.score).map((tier) => ({
      rider_id: o.riderId,
      type_id: 'score_milestone' as const,
      dedupe_key: dedupe.milestone(o.riderId, tier),
      title: `${tier} points unlocked`,
      score: o.score,
      car_id: o.carId,
      run_id: o.runId,
      meta: { tier, offers: milestoneOffers(tier) },
    })),
  );
}

/** Official race standings → 1st/2nd/3rd awards. */
export function grantRacePodium(o: { carId: string; startedAtIso: string; standings: { riderId: string; displayName: string; score: number }[] }) {
  const podium = racePodium(o.standings);
  return grant(
    podium.map((p) => ({
      rider_id: p.riderId,
      type_id: 'race_podium' as const,
      dedupe_key: dedupe.race(o.carId, o.startedAtIso, p.rank),
      title: `${ORDINAL[p.rank - 1]} place · car race`,
      rank: p.rank,
      score: p.score,
      car_id: o.carId,
      meta: { racers: o.standings.length, raceStartedAt: o.startedAtIso },
    })),
  );
}

let lastDailySweep = 0;

/**
 * Award #1 of every finished Boston day in the last `days` days (today is still open).
 * Cheap and idempotent; throttled to once a minute per server instance.
 */
export async function ensureDailyChampions(days = 14): Promise<void> {
  if (Date.now() - lastDailySweep < 60_000) return;
  lastDailySweep = Date.now();
  try {
    const today = bostonDate();
    const { data, error } = await db()
      .from('daily_leaderboard')
      .select('day,rider_id,best_score')
      .gte('day', shiftDay(today, -days))
      .lt('day', today)
      .order('best_score', { ascending: false })
      .limit(1000);
    if (error) throw error;
    const winners = dailyWinners((data ?? []) as { day: string; rider_id: string; best_score: number }[]);
    await grant(
      winners.map((w) => ({
        rider_id: w.rider_id,
        type_id: 'daily_champion' as const,
        dedupe_key: dedupe.daily(w.day),
        title: `Daily champion · ${w.day}`,
        rank: 1,
        score: w.best_score,
        day: w.day,
        won_at: new Date(`${shiftDay(w.day, 1)}T04:59:00Z`).toISOString(),
      })),
    );
  } catch (err) {
    console.warn('[awards] daily sweep failed', err);
  }
}
