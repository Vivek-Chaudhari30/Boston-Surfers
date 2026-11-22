/**
 * Join tokens and claim codes (ARCHITECTURE §4 "Join token and claim code"). Pure, tested.
 *
 * Join token: base64url(carId + '.' + window) + '.' + hmac16, window = floor(now / 30 s).
 * Accepted for the current or previous window, so a token lives at most 60 s.
 *
 * Claim code: 6 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789, QR payload `CB1:<code>`,
 * expires after 120 s. dispenseId = first 8 hex chars of the claim id.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  CLAIM_CODE_ALPHABET,
  CLAIM_CODE_LENGTH,
  CLAIM_QR_PREFIX,
  CLAIM_TTL_MS,
  JOIN_TOKEN_WINDOW_MS,
} from '@cb/shared';

const HMAC_CHARS = 16;

export function joinWindow(nowMs: number): number {
  return Math.floor(nowMs / JOIN_TOKEN_WINDOW_MS);
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, HMAC_CHARS);
}

export function createJoinToken(
  carId: string,
  secret: string,
  nowMs: number = Date.now(),
): { token: string; expiresAt: Date } {
  if (!secret) throw new Error('join token secret is empty');
  const w = joinWindow(nowMs);
  const payload = Buffer.from(`${carId}.${w}`).toString('base64url');
  // Valid through the end of the next window.
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: new Date((w + 2) * JOIN_TOKEN_WINDOW_MS) };
}

export type JoinTokenCheck =
  | { ok: true; window: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_car' | 'expired' };

export function verifyJoinToken(
  token: string,
  carId: string,
  secret: string,
  nowMs: number = Date.now(),
): JoinTokenCheck {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [payload, mac] = parts as [string, string];

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const tokenCar = decoded.slice(0, dot);
  const w = Number(decoded.slice(dot + 1));
  if (!Number.isInteger(w)) return { ok: false, reason: 'malformed' };
  if (tokenCar !== carId) return { ok: false, reason: 'wrong_car' };

  const now = joinWindow(nowMs);
  if (w !== now && w !== now - 1) return { ok: false, reason: 'expired' };
  return { ok: true, window: w };
}

/** `https://<app>/mobile?car=<carId>&t=<token>` */
export function joinUrl(appUrl: string, carId: string, token: string): string {
  const url = new URL('/mobile', appUrl);
  url.searchParams.set('car', carId);
  url.searchParams.set('t', token);
  return url.toString();
}

/** Random 6-char claim code. `rand(n)` returns an int in [0, n); injectable for tests. */
export function generateClaimCode(rand: (n: number) => number = (n) => randomInt(n)): string {
  let code = '';
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) code += CLAIM_CODE_ALPHABET[rand(CLAIM_CODE_ALPHABET.length)];
  return code;
}

const CLAIM_RE = new RegExp(`^[${CLAIM_CODE_ALPHABET}]{${CLAIM_CODE_LENGTH}}$`);

export function isClaimCode(value: string): boolean {
  return CLAIM_RE.test(value);
}

export function claimQrPayload(code: string): string {
  return `${CLAIM_QR_PREFIX}${code}`;
}

export function claimExpiresAt(nowMs: number = Date.now()): Date {
  return new Date(nowMs + CLAIM_TTL_MS);
}

/** First 8 hex chars of the claim uuid; fits the serial protocol's 1–12 char id. */
export function dispenseIdFromClaimId(claimId: string): string {
  const hex = claimId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{8}/.test(hex)) throw new Error(`not a uuid: ${claimId}`);
  return hex.slice(0, 8);
}
