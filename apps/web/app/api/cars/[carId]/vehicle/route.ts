import { CarIdParams, PinVehicleRequest } from '@cb/shared';
import { notImplemented, parseBody, parseObject } from '@/lib/http';

/** POST /api/cars/:carId/vehicle (kiosk) → OkResponse. Pins the demo vehicle. */
export async function POST(req: Request, ctx: { params: Promise<{ carId: string }> }) {
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, PinVehicleRequest);
  if (!body.ok) return body.response;
  // TODO: requireKiosk(req); update cars.vehicle_id.
  return notImplemented();
}
