/**
 * Awards: pure logic and the client-facing schema (no DB, safe to import anywhere).
 * Kept inside apps/web on purpose: no change to the frozen @cb/shared api.ts contract.
 */
import { z } from 'zod';
import { rewardCatalog } from './reward-catalog';

export const AWARD_TYPES = ['car_champion', 'race_podium', 'daily_champion', 'score_milestone'] as const;
export type AwardTypeId = (typeof AWARD_TYPES)[number];

/** Milestone tiers come from the station reward catalog (250 / 500 / 750). */
export const MILESTONE_TIERS: number[] = [...new Set(rewardCatalog.map((r) => r.points))].sort((a, b) => a - b);

/** Every tier the score reaches. */
export function milestonesReached(score: number): number[] {
  return MILESTONE_TIERS.filter((t) => score >= t);
}

/** The catalog offers a tier unlocks, as "Place · OFFER". */
export function milestoneOffers(tier: number): string[] {
  return rewardCatalog.filter((r) => r.points === tier).map((r) => `${r.place} · ${r.offer}`);
}

export const ORDINAL = ['1st', '2nd', '3rd'] as const;

/** Top 3 of a race (needs at least 2 racers so a solo run is not a "podium"). */
export function racePodium<T extends { riderId: string; score: number }>(standings: T[]): (T & { rank: number })[] {
  if (standings.length < 2) return [];
  return standings
    .filter((s) => s.score > 0)
    .slice(0, 3)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

/** Highest score per day from daily-board rows (first row wins ties, so pass rows ordered by score desc, first_at asc). */
export function dailyWinners<T extends { day: string; best_score: number }>(rows: T[]): T[] {
  const out = new Map<string, T>();
  for (const r of rows) {
    const cur = out.get(r.day);
    if (!cur || r.best_score > cur.best_score) out.set(r.day, r);
  }
  return [...out.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export const dedupe = {
  carChampion: (claimId: string) => `car:${claimId}`,
  race: (carId: string, startedAtIso: string, rank: number) => `race:${carId}:${startedAtIso}:${rank}`,
  daily: (day: string) => `daily:${day}`,
  milestone: (riderId: string, tier: number) => `milestone:${riderId}:${tier}`,
};

/** Mask a phone for display on the rider's own profile: +1 ••• ••• 0123. */
export function maskPhone(e164: string): string {
  const last4 = e164.replace(/\D/g, '').slice(-4);
  return `+1 ••• ••• ${last4.padStart(4, '•')}`;
}

// ── GET /api/mobile/profile response ─────────────────────────────────────────

export const Award = z.object({
  id: z.string(),
  typeId: z.enum(AWARD_TYPES),
  title: z.string(),
  rank: z.number().nullable(),
  score: z.number().nullable(),
  carId: z.string().nullable(),
  day: z.string().nullable(),
  wonAt: z.string(),
  /** Car champion only: the voucher claim behind it. */
  claim: z
    .object({ code: z.string(), expiresAt: z.string(), redeemedAt: z.string().nullable(), dispenseStatus: z.string().nullable() })
    .nullable(),
  offers: z.array(z.string()),
});
export type Award = z.infer<typeof Award>;

export const AwardType = z.object({
  id: z.enum(AWARD_TYPES),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  count: z.number().int(),
});
export type AwardType = z.infer<typeof AwardType>;

export const ProfilePlay = z.object({
  id: z.string(),
  score: z.number().nullable(),
  coins: z.number().nullable(),
  durationMs: z.number().nullable(),
  carId: z.string(),
  status: z.string(),
  playedAt: z.string(),
});
export type ProfilePlay = z.infer<typeof ProfilePlay>;

export const MobileProfile = z.object({
  rider: z.object({ id: z.string(), displayName: z.string(), phoneMasked: z.string(), memberSince: z.string() }),
  stats: z.object({
    plays: z.number().int(),
    bestScore: z.number().int(),
    totalCoins: z.number().int(),
    daysPlayed: z.number().int(),
    wins: z.number().int(),
  }),
  awardTypes: z.array(AwardType),
  awards: z.array(Award),
  plays: z.array(ProfilePlay),
});
export type MobileProfile = z.infer<typeof MobileProfile>;
