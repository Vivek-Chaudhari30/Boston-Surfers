import { CreateRideRequest } from '@cb/shared';
import { notImplemented, parseBody } from '@/lib/http';

/** POST /api/rides → CreateRideResponse. Ends any other active ride for this rider. */
export async function POST(req: Request) {
  const body = await parseBody(req, CreateRideRequest);
  if (!body.ok) return body.response;
  // TODO: verifyJoinToken(joinToken, carId, SESSION_SECRET); rateLimit('join'); setRideSession; broadcast rider_joined.
  return notImplemented();
}
