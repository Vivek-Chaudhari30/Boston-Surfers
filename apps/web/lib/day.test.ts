import { describe, expect, it } from 'vitest';
import { parseDay, shiftDay } from './day';

describe('parseDay', () => {
  const today = '2026-11-21';
  it('accepts a valid past day and today', () => {
    expect(parseDay('2026-11-20', today)).toBe('2026-11-20');
    expect(parseDay(today, today)).toBe(today);
    expect(parseDay('2024-02-29', today)).toBe('2024-02-29');
  });
  it('falls back to today for malformed, impossible or future days', () => {
    for (const bad of ['2026-13-45', '0000-00-00', '2026-02-31', 'abc', '', '2026-11-22', undefined]) expect(parseDay(bad, today)).toBe(today);
  });
});

describe('shiftDay', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});
