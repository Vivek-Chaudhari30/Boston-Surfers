import { describe, expect, it } from 'vitest';
import { JOIN_TOKEN_WINDOW_MS, isValidDispenseId } from '@cb/shared';
import {
  claimExpiresAt,
  claimQrPayload,
  createJoinToken,
  dispenseIdFromClaimId,
  generateClaimCode,
  isClaimCode,
  joinUrl,
  verifyJoinToken,
} from './tokens';

const SECRET = 'test-secret-test-secret-test-secret!';
const T0 = 1_800_000_000_000; // a fixed instant
const W = JOIN_TOKEN_WINDOW_MS;

describe('join tokens', () => {
  it('round-trips in the same window', () => {
    const { token } = createJoinToken('green-3812', SECRET, T0);
    expect(verifyJoinToken(token, 'green-3812', SECRET, T0)).toMatchObject({ ok: true });
  });

  it('accepts the previous window but not older', () => {
    const { token } = createJoinToken('green-3812', SECRET, T0);
    const start = Math.floor(T0 / W) * W;
    expect(verifyJoinToken(token, 'green-3812', SECRET, start + W + 1).ok).toBe(true);
    expect(verifyJoinToken(token, 'green-3812', SECRET, start + 2 * W)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects tokens from the future', () => {
    const { token } = createJoinToken('green-3812', SECRET, T0 + 5 * W);
    expect(verifyJoinToken(token, 'green-3812', SECRET, T0)).toEqual({ ok: false, reason: 'expired' });
  });

  it('expiresAt is the end of the next window', () => {
    const { expiresAt } = createJoinToken('green-3812', SECRET, T0);
    const start = Math.floor(T0 / W) * W;
    expect(expiresAt.getTime()).toBe(start + 2 * W);
  });

  it('rejects the wrong car, a bad secret, tampering and garbage', () => {
    const { token } = createJoinToken('green-3812', SECRET, T0);
    expect(verifyJoinToken(token, 'red-1500', SECRET, T0)).toEqual({ ok: false, reason: 'wrong_car' });
    expect(verifyJoinToken(token, 'green-3812', 'other-secret', T0)).toEqual({ ok: false, reason: 'bad_signature' });
    const forged = Buffer.from(`red-1500.${Math.floor(T0 / W)}`).toString('base64url') + '.' + token.split('.')[1];
    expect(verifyJoinToken(forged, 'red-1500', SECRET, T0)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyJoinToken('nope', 'green-3812', SECRET, T0)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyJoinToken('a.b.c', 'green-3812', SECRET, T0)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('builds the QR url', () => {
    expect(joinUrl('https://cb.example.com', 'green-3812', 'abc.def')).toBe(
      'https://cb.example.com/play?car=green-3812&t=abc.def',
    );
  });
});

describe('claim codes', () => {
  it('generates 6 chars from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateClaimCode();
      expect(code).toHaveLength(6);
      expect(isClaimCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('uses the injected random source', () => {
    expect(generateClaimCode(() => 0)).toBe('AAAAAA');
    expect(generateClaimCode((n) => n - 1)).toBe('999999');
  });

  it('validates codes', () => {
    expect(isClaimCode('ABC234')).toBe(true);
    expect(isClaimCode('ABC10O')).toBe(false);
    expect(isClaimCode('abc234')).toBe(false);
    expect(isClaimCode('ABC23')).toBe(false);
  });

  it('QR payload, expiry and dispense id', () => {
    expect(claimQrPayload('ABC234')).toBe('CB1:ABC234');
    expect(claimExpiresAt(T0).getTime()).toBe(T0 + 120_000);
    const id = dispenseIdFromClaimId('3F2A9C1B-0000-4000-8000-000000000000');
    expect(id).toBe('3f2a9c1b');
    expect(isValidDispenseId(id)).toBe(true);
    expect(() => dispenseIdFromClaimId('not-a-uuid')).toThrow();
  });
});
