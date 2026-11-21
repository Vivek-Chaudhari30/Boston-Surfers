import { CreateRideRequest, carChannel, type CreateRideResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { errorResponse, handle, parseBody } from '@/lib/http';
import { activeRideFor, getCar } from '@/lib/queries';
import { rateLimit } from '@/lib/rate-limit';
import { broadcastChanged } from '@/lib/realtime';
import { getRiderSession, setRideSession } from '@/lib/session';
import { verifyJoinToken } from '@/lib/tokens';

/**
 * POST /api/rides { carId, joinToken } → { ride }.
 * Needs a fresh join token (≤ 60 s) from the kiosk QR. Rejoining the same car keeps the ride;
 * joining another car ends the old one.
 */
export const POST = handle(async (req: Request) => {
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'sign up first', 'NO_SESSION');
  const body = await parseBody(req, CreateRideRequest);
  if (!body.ok) return body.response;
  const { carId, joinToken } = body.data;

  const rl = rateLimit('join', session.riderId);
  if (!rl.ok) return errorResponse(429, 'too many joins', 'RATE_LIMITED');

  const check = verifyJoinToken(joinToken, carId, serverEnv().SESSION_SECRET);
  if (!check.ok) {
    const msg = check.reason === 'expired' ? 'QR code expired, scan the kiosk again' : 'invalid QR code';
    return errorResponse(403, msg, `JOIN_${check.reason.toUpperCase()}`);
  }
  const car = await getCar(carId);
  if (!car) return errorResponse(404, 'unknown car', 'NO_CAR');

  let ride = await activeRideFor(session.riderId);
  if (ride && ride.car_id !== carId) {
    await db().from('rides').update({ ended_at: new Date().toISOString() }).eq('id', ride.id);
    ride = null;
  }
  if (!ride) {
    const { data, error } = await db()
      .from('rides')
      .insert({ rider_id: session.riderId, car_id: carId })
      .select('id,rider_id,car_id,started_at,ended_at')
      .single();
    if (error) throw error;
    ride = data;
    void broadcastChanged(carChannel(carId), 'rider_joined');
  }

  await setRideSession(ride.id);
  const res: CreateRideResponse = {
    ride: { id: ride.id, carId, line: car.line, startedAt: new Date(ride.started_at).toISOString() },
  };
  return Response.json(res);
});
