import { describe, expect, it } from 'vitest';
import type { LiveRacer, RacePosMsg } from '@/lib/race';
import { GO_AT_JITTER_MS, medal, mergeRacer, nextGoAt, shouldSendPos } from './raceLogic';

const id = '11111111-1111-4111-8111-111111111111';
const pos = (score: number, alive: boolean): RacePosMsg => ({ raceId: 'race1234', riderId: id, name: 'Spidey', score, alive });

describe('nextGoAt', () => {
  it('sets the first value', () => expect(nextGoAt(null, 1000, 5000)).toBe(6000));
  it('keeps the old value within the jitter', () => expect(nextGoAt(6000, 2000, 4000 + GO_AT_JITTER_MS - 1)).toBe(6000));
  it('moves when the kiosk disagrees by more than the jitter', () => expect(nextGoAt(6000, 2000, 4000 + GO_AT_JITTER_MS + 1)).toBe(6401));
});

describe('shouldSendPos', () => {
  it('throttles', () => {
    expect(shouldSendPos(1000, 1400, 500)).toBe(false);
    expect(shouldSendPos(1000, 1500, 500)).toBe(true);
  });
  it('force bypasses the throttle', () => expect(shouldSendPos(1000, 1001, 500, true)).toBe(true));
});

describe('mergeRacer', () => {
  it('adds and updates a racer', () => {
    const a = mergeRacer(new Map(), pos(10, true), 1);
    const b = mergeRacer(a, pos(20, true), 2);
    expect(b.get(id)?.score).toBe(20);
    expect(a.get(id)?.score).toBe(10);
  });
  it('never revives a crashed racer or lowers the final score', () => {
    const dead = mergeRacer(new Map(), pos(50, false), 1);
    const after = mergeRacer(dead, pos(30, true), 2);
    const r = after.get(id) as LiveRacer;
    expect(r.alive).toBe(false);
    expect(r.score).toBe(50);
    expect(r.seenAt).toBe(2);
  });
});

describe('medal', () => {
  it('uses medals then numbers', () => {
    expect(medal(0)).toBe('🥇');
    expect(medal(3)).toBe('4');
  });
});
