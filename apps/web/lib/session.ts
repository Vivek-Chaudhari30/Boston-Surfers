// Server only.
/**
 * Rider session cookies (ARCHITECTURE §4): httpOnly HS256 JWTs signed with SESSION_SECRET (jose).
 *   cb_rider = { riderId }, 30 days
 *   cb_ride  = { rideId }, 90 minutes (rides auto-expire)
 */
import { RIDE_TTL_MS } from '@cb/shared';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { serverEnv } from './env';

export const RIDER_COOKIE = 'cb_rider';
export const RIDE_COOKIE = 'cb_ride';
export const RIDER_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
const RIDE_COOKIE_MAX_AGE_S = Math.floor(RIDE_TTL_MS / 1000);

export type RiderSession = { riderId: string };
export type RideSession = { rideId: string };

function key(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SESSION_SECRET);
}

export async function signToken(claims: Record<string, string>, maxAgeS: number): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeS}s`)
    .sign(key());
}

export async function verifyToken(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

async function setCookie(name: string, value: string, maxAgeS: number) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeS,
  });
}

export async function setRiderSession(riderId: string): Promise<void> {
  await setCookie(RIDER_COOKIE, await signToken({ riderId }, RIDER_COOKIE_MAX_AGE_S), RIDER_COOKIE_MAX_AGE_S);
}

export async function getRiderSession(): Promise<RiderSession | null> {
  const p = await verifyToken((await cookies()).get(RIDER_COOKIE)?.value);
  return typeof p?.riderId === 'string' ? { riderId: p.riderId } : null;
}

export async function setRideSession(rideId: string): Promise<void> {
  await setCookie(RIDE_COOKIE, await signToken({ rideId }, RIDE_COOKIE_MAX_AGE_S), RIDE_COOKIE_MAX_AGE_S);
}

export async function getRideSession(): Promise<RideSession | null> {
  const p = await verifyToken((await cookies()).get(RIDE_COOKIE)?.value);
  return typeof p?.rideId === 'string' ? { rideId: p.rideId } : null;
}

export async function clearRideSession(): Promise<void> {
  (await cookies()).delete(RIDE_COOKIE);
}
