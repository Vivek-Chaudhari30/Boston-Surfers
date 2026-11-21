import { CarIdParams } from '@cb/shared';
import { notImplemented, parseObject } from '@/lib/http';

/** GET /api/cars/:carId/state (kiosk) → CarStateResponse. */
export async function GET(_req: Request, ctx: { params: Promise<{ carId: string }> }) {
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  // TODO: requireKiosk(req); car row, car_leaderboard top 5, active riders, pending claim.
  return notImplemented();
}
