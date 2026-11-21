import { CarIdParams, PinVehicleRequest, type OkResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';

/** POST /api/cars/:carId/vehicle (kiosk) { vehicleId } → { ok }. Pins the demo vehicle. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, PinVehicleRequest);
  if (!body.ok) return body.response;

  const { data, error } = await db()
    .from('cars')
    .update({ vehicle_id: body.data.vehicleId })
    .eq('id', params.data.carId)
    .select('id');
  if (error) throw error;
  if (!data?.length) return errorResponse(404, 'unknown car', 'NO_CAR');
  return Response.json({ ok: true } satisfies OkResponse);
});
