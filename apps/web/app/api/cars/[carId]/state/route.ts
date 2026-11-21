import { CarIdParams, type CarStateResponse } from '@cb/shared';
import { errorResponse, handle, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { activeRiderCount, carBoard, getCar, pendingClaimFor, toCar, toEntries } from '@/lib/queries';

/** GET /api/cars/:carId/state (kiosk) → { car, leaderboard, activeRiders, pendingClaim }. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const { carId } = params.data;

  const car = await getCar(carId);
  if (!car) return errorResponse(404, 'unknown car', 'NO_CAR');
  const [board, activeRiders, pendingClaim] = await Promise.all([
    carBoard(carId),
    activeRiderCount(carId),
    pendingClaimFor(carId),
  ]);
  const res: CarStateResponse = { car: toCar(car), leaderboard: toEntries(board), activeRiders, pendingClaim };
  return Response.json(res, { headers: { 'cache-control': 'no-store' } });
});
