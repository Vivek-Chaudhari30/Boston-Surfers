import { describe, expect, it } from 'vitest';
import { RACE, RaceQuery, podiumFromRuns, raceWindow, shouldEndRace, type LiveRacer } from './race';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('RaceQuery', () => {
  it('parses since and a rider list', () => {
    const r = RaceQuery.parse({ since: '2026-01-01T00:00:00.000Z', riders: `${A},${B}` });
    expect(r.riders).toEqual([A, B]);
  });
  it('treats missing riders as null and rejects junk', () => {
    expect(RaceQuery.parse({ since: '2026-01-01T00:00:00Z' }).riders).toBeNull();
    expect(RaceQuery.safeParse({ since: 'nope' }).success).toBe(false);
    expect(RaceQuery.safeParse({ since: '2026-01-01T00:00:00Z', riders: 'abc' }).success).toBe(false);
  });
});

describe('raceWindow', () => {
  it('brackets since', () => {
    const w = raceWindow('2026-01-01T00:00:10.000Z');
    expect(Date.parse('2026-01-01T00:00:10.000Z') - Date.parse(w.from)).toBe(RACE.WINDOW_BEFORE_MS);
    expect(Date.parse(w.to) - Date.parse('2026-01-01T00:00:10.000Z')).toBe(RACE.WINDOW_AFTER_MS);
  });
});

describe('race helpers', () => {
  it('podiumFromRuns keeps best per participant', () => {
    const p = podiumFromRuns(
      [{ rider_id: A, score: 5 }, { rider_id: A, score: 9 }, { rider_id: B, score: 7 }],
      new Map([[A, 'Ann']]),
      new Set([A, B]),
    );
    expect(p.map((s) => [s.displayName, s.score])).toEqual([['Ann', 9], ['Rider', 7]]);
  });
  it('shouldEndRace when all crashed', () => {
    const racers = new Map<string, LiveRacer>([[A, { riderId: A, name: 'a', score: 1, alive: false, seenAt: 1000 }]]);
    expect(shouldEndRace({ participants: [A], racers, startedAt: 0, now: 2000 })).toBe(true);
  });
});
