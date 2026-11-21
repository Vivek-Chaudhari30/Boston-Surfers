import type { MeResponse } from '@cb/shared';
import { handle } from '@/lib/http';
import { activeRideFor, getCar, getRider } from '@/lib/queries';
import { getRiderSession } from '@/lib/session';

/** GET /api/me → { rider | null, activeRide | null }. */
export const GET = handle(async (_req: Request) => {
  const session = await getRiderSession();
  const rider = session ? await getRider(session.riderId) : null;
  if (!rider) return Response.json({ rider: null, activeRide: null } satisfies MeResponse);

  const ride = await activeRideFor(rider.id);
  const car = ride ? await getCar(ride.car_id) : null;
  const res: MeResponse = {
    rider: { id: rider.id, displayName: rider.display_name },
    activeRide:
      ride && car
        ? { id: ride.id, carId: ride.car_id, line: car.line, startedAt: new Date(ride.started_at).toISOString() }
        : null,
  };
  return Response.json(res);
});
