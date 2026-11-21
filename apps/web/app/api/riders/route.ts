import { CreateRiderRequest } from '@cb/shared';
import { notImplemented, parseBody } from '@/lib/http';

/** POST /api/riders → 201 CreateRiderResponse. Sets cb_rider. Known phone → existing rider. */
export async function POST(req: Request) {
  const body = await parseBody(req, CreateRiderRequest);
  if (!body.ok) return body.response;
  // TODO: rateLimit('signup', ip); upsert rider by phone; setRiderSession; never return phone.
  return notImplemented();
}
