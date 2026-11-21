import { RideIdParams } from '@cb/shared';
import { notImplemented, parseObject } from '@/lib/http';

/** POST /api/rides/:rideId/end → EndRideResponse. Ends the ride even for non-winners. */
export async function POST(_req: Request, ctx: { params: Promise<{ rideId: string }> }) {
  const params = parseObject(await ctx.params, RideIdParams);
  if (!params.ok) return params.response;
  // TODO: leader check, 1 prize per rider per day, PRIZE_MIN_RIDERS, create claim (120 s); broadcast claim_pending.
  return notImplemented();
}
