import { cookies } from 'next/headers';
import { handle } from '@/lib/http';
import { RIDE_COOKIE, RIDER_COOKIE } from '@/lib/session';

/** POST /api/riders/logout → { ok }. Clears the rider and ride cookies on this device ("Not you?"). */
export const POST = handle(async () => {
  const jar = await cookies();
  jar.delete(RIDER_COOKIE);
  jar.delete(RIDE_COOKIE);
  return Response.json({ ok: true });
});
