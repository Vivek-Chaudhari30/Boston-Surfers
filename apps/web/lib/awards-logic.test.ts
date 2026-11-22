import { describe, expect, it } from 'vitest';
import { MILESTONE_TIERS, dailyWinners, maskPhone, milestoneOffers, milestonesReached, racePodium } from './awards-logic';

describe('milestones', () => {
  it('tiers come from the reward catalog', () => {
    expect(MILESTONE_TIERS).toEqual([250, 500, 750]);
  });
  it('lists every tier reached', () => {
    expect(milestonesReached(100)).toEqual([]);
    expect(milestonesReached(250)).toEqual([250]);
    expect(milestonesReached(900)).toEqual([250, 500, 750]);
  });
  it('names the offers a tier unlocks', () => {
    expect(milestoneOffers(250).length).toBeGreaterThan(0);
    expect(milestoneOffers(123)).toEqual([]);
  });
});

describe('racePodium', () => {
  const s = (riderId: string, score: number) => ({ riderId, score });
  it('needs two racers', () => {
    expect(racePodium([s('a', 900)])).toEqual([]);
  });
  it('takes the top 3 with ranks and skips zero scores', () => {
    expect(racePodium([s('a', 900), s('b', 500), s('c', 0)]).map((p) => [p.riderId, p.rank])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(racePodium([s('a', 9), s('b', 8), s('c', 7), s('d', 6)])).toHaveLength(3);
  });
});

describe('dailyWinners', () => {
  it('keeps the first highest row per day', () => {
    const rows = [
      { day: '2026-11-20', rider_id: 'a', best_score: 900 },
      { day: '2026-11-19', rider_id: 'b', best_score: 700 },
      { day: '2026-11-20', rider_id: 'c', best_score: 900 },
      { day: '2026-11-19', rider_id: 'd', best_score: 300 },
    ];
    expect(dailyWinners(rows).map((r) => [r.day, r.rider_id])).toEqual([
      ['2026-11-19', 'b'],
      ['2026-11-20', 'a'],
    ]);
  });
});

describe('maskPhone', () => {
  it('shows only the last 4 digits', () => {
    expect(maskPhone('+16175550123')).toBe('+1 ••• ••• 0123');
  });
});
