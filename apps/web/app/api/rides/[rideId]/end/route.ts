import { DAILY_CHANNEL, RideIdParams, carChannel, type EndRideResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { errorResponse, handle, parseObject } from '@/lib/http';
import { activeRiderCount, carBoard } from '@/lib/queries';
import { broadcastChanged } from '@/lib/realtime';
import { clearRideSession, getRiderSession } from '@/lib/session';
import { bostonDate, bostonDayRange } from '@/lib/time';
import { claimExpiresAt, generateClaimCode } from '@/lib/tokens';

/**
 * POST /api/rides/:rideId/end → won (with a 2-minute claim) | not_leader | no_score | already_claimed_today.
 * Always ends the ride, so riders who left drop off the car board (ARCHITECTURE §0, §2.7).
 */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ rideId: string }> }) => {
  const params = parseObject(await ctx.params, RideIdParams);
  if (!params.ok) return params.response;
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'sign up first', 'NO_SESSION');

  const { data: ride, error } = await db()
    .from('rides')
    .select('id,rider_id,car_id,ended_at')
    .eq('id', params.data.rideId)
    .maybeSingle();
  if (error) throw error;
  if (!ride) return errorResponse(404, 'ride not found', 'NO_RIDE');
  if (ride.rider_id !== session.riderId) return errorResponse(403, 'not your ride', 'NOT_OWNER');

  // Idempotent retry: a still-valid claim for this ride is returned again.
  const { data: existing } = await db()
    .from('claims')
    .select('code,expires_at')
    .eq('ride_id', ride.id)
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (existing) {
    return Response.json({
      result: 'won',
      claim: { code: existing.code, expiresAt: new Date(existing.expires_at).toISOString() },
    } satisfies EndRideResponse);
  }
  if (ride.ended_at) return errorResponse(409, 'ride already ended', 'RIDE_ENDED');

  const [board, riders] = await Promise.all([carBoard(ride.car_id), activeRiderCount(ride.car_id)]);
  const endRide = async () => {
    await db().from('rides').update({ ended_at: new Date().toISOString() }).eq('id', ride.id).is('ended_at', null);
    await clearRideSession();
    void broadcastChanged(carChannel(ride.car_id), 'leaderboard');
  };

  const { data: best } = await db()
    .from('runs')
    .select('score')
    .eq('ride_id', ride.id)
    .eq('status', 'finished')
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!best) {
    await endRide();
    return Response.json({ result: 'no_score' } satisfies EndRideResponse);
  }

  const { start, end } = bostonDayRange(bostonDate());
  const { count: claimedToday } = await db()
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('rider_id', session.riderId)
    .gte('redeemed_at', start.toISOString())
    .lt('redeemed_at', end.toISOString());
  if ((claimedToday ?? 0) > 0) {
    await endRide();
    return Response.json({ result: 'already_claimed_today' } satisfies EndRideResponse);
  }

  const leader = board[0];
  const rank = board.findIndex((r) => r.rider_id === session.riderId) + 1;
  if (!leader || leader.rider_id !== session.riderId) {
    await endRide();
    return Response.json({
      result: 'not_leader',
      rank: rank > 0 ? rank : board.length + 1,
      leader: { displayName: leader?.display_name ?? '-', score: leader?.best_score ?? 0 },
    } satisfies EndRideResponse);
  }

  if (riders < serverEnv().PRIZE_MIN_RIDERS) {
    await endRide();
    return errorResponse(409, `prizes need at least ${serverEnv().PRIZE_MIN_RIDERS} riders in the car`, 'NOT_ENOUGH_RIDERS');
  }

  // Winner: issue a one-time 6-char claim code (retry on the rare unique collision).
  const expiresAt = claimExpiresAt();
  let code = '';
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateClaimCode();
    const { error: insErr } = await db().from('claims').insert({
      code: candidate,
      ride_id: ride.id,
      rider_id: session.riderId,
      car_id: ride.car_id,
      score: leader.best_score,
      expires_at: expiresAt.toISOString(),
    });
    if (!insErr) code = candidate;
    else if (insErr.code !== '23505') throw insErr;
  }
  if (!code) throw new Error('could not allocate a claim code');

  await endRide();
  void broadcastChanged(carChannel(ride.car_id), 'claim_pending');
  void broadcastChanged(DAILY_CHANNEL, 'daily');
  return Response.json({ result: 'won', claim: { code, expiresAt: expiresAt.toISOString() } } satisfies EndRideResponse);
});
