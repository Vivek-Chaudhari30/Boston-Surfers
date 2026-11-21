import { describe, expect, it } from 'vitest';
import { validateRun, type RideRow, type RunRow } from './score';

const NOW = Date.parse('2026-11-21T20:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const TTL = 90 * 60_000;

const run: RunRow = { rider_id: 'r1', status: 'started', started_at: ago(30_000) };
const ride: RideRow = { rider_id: 'r1', ended_at: null, started_at: ago(10 * 60_000) };
const good = { score: 500, coins: 10, durationMs: 25_000 };

const check = (over: Partial<Parameters<typeof validateRun>[0]> = {}) =>
  validateRun({ run, ride, riderId: 'r1', input: good, now: NOW, rideTtlMs: TTL, ...over });

describe('validateRun', () => {
  it('accepts a plausible run', () => expect(check()).toBeNull());
  it('checks ownership and status', () => {
    expect(check({ riderId: 'r2' })).toBe('not_owner');
    expect(check({ run: { ...run, status: 'finished' } })).toBe('already_finished');
    expect(check({ run: { ...run, status: 'rejected' } })).toBe('already_finished');
  });
  it('requires an active ride', () => {
    expect(check({ ride: null })).toBe('ride_inactive');
    expect(check({ ride: { ...ride, ended_at: ago(1000) } })).toBe('ride_inactive');
    expect(check({ ride: { ...ride, started_at: ago(TTL + 1) } })).toBe('ride_inactive');
  });
  it('enforces duration bounds', () => {
    expect(check({ input: { ...good, durationMs: 2999 } })).toBe('too_short');
    expect(check({ input: { ...good, durationMs: 32_001 } })).toBe('duration_mismatch');
    expect(check({ input: { ...good, durationMs: 32_000 } })).toBeNull();
    expect(check({ run: { ...run, started_at: ago(10 * 60_000 + 1) } })).toBe('too_old');
  });
  it('caps the score at 70/s × 1.1 + 50', () => {
    // 25 s → 25 × 70 × 1.1 + 50 = 1975
    expect(check({ input: { ...good, score: 1975 } })).toBeNull();
    expect(check({ input: { ...good, score: 1976 } })).toBe('score_too_high');
  });
  it('coins can not be worth more than the score', () => {
    expect(check({ input: { ...good, score: 100, coins: 11 } })).toBe('coins_mismatch');
  });
});
