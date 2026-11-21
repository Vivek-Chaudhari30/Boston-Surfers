import { StartRunRequest, type StartRunResponse } from '@cb/shared';
import { randomInt } from 'node:crypto';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody } from '@/lib/http';
import { activeRideFor } from '@/lib/queries';
import { rateLimit } from '@/lib/rate-limit';
import { getRiderSession } from '@/lib/session';

/** POST /api/runs { rideId } → { runId, seed, startedAt }. */
export const POST = handle(async (req: Request) => {
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'sign up first', 'NO_SESSION');
  const body = await parseBody(req, StartRunRequest);
  if (!body.ok) return body.response;

  const ride = await activeRideFor(session.riderId);
  if (!ride || ride.id !== body.data.rideId) return errorResponse(409, 'ride is not active, scan the kiosk again', 'RIDE_INACTIVE');

  const rl = rateLimit('startRun', session.riderId);
  if (!rl.ok) return errorResponse(429, 'one run every 3 seconds', 'RATE_LIMITED');

  const seed = randomInt(2 ** 31 - 1);
  const { data, error } = await db()
    .from('runs')
    .insert({ ride_id: ride.id, rider_id: session.riderId, car_id: ride.car_id, seed })
    .select('id,seed,started_at')
    .single();
  if (error) throw error;

  const res: StartRunResponse = { runId: data.id, seed: data.seed, startedAt: new Date(data.started_at).toISOString() };
  return Response.json(res);
});
