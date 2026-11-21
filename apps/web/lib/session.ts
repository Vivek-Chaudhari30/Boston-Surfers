// Server only.
/**
 * Rider session cookies (ARCHITECTURE §4): httpOnly JWTs signed with SESSION_SECRET via jose.
 *   cb_rider = { riderId }, 30 days
 *   cb_ride  = { rideId }
 */
export const RIDER_COOKIE = 'cb_rider';
export const RIDE_COOKIE = 'cb_ride';
export const RIDER_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

export type RiderSession = { riderId: string };
export type RideSession = { rideId: string };

/** TODO: SignJWT({ riderId }) HS256, set httpOnly/secure/sameSite=lax cookie. */
export async function setRiderSession(_riderId: string): Promise<void> {
  throw new Error('setRiderSession: not implemented');
}

/** TODO: jwtVerify the cb_rider cookie; null when missing/invalid. */
export async function getRiderSession(): Promise<RiderSession | null> {
  throw new Error('getRiderSession: not implemented');
}

/** TODO: same as rider, for cb_ride. */
export async function setRideSession(_rideId: string): Promise<void> {
  throw new Error('setRideSession: not implemented');
}

export async function getRideSession(): Promise<RideSession | null> {
  throw new Error('getRideSession: not implemented');
}

export async function clearRideSession(): Promise<void> {
  throw new Error('clearRideSession: not implemented');
}
