import { CreateRiderRequest, type CreateRiderResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody } from '@/lib/http';
import { isNameAllowed } from '@/lib/name-filter';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { setRiderSession } from '@/lib/session';

/** POST /api/riders → 201 { rider }. Sets cb_rider. A known phone returns that rider with its stored name (never renamed). */
export const POST = handle(async (req: Request) => {
  const rl = rateLimit('signup', clientIp(req));
  if (!rl.ok) return errorResponse(429, 'too many signups, slow down', 'RATE_LIMITED');
  const body = await parseBody(req, CreateRiderRequest);
  if (!body.ok) return body.response;
  const { phone, displayName } = body.data;

  const existing = await db().from('riders').select('id,display_name').eq('phone', phone).maybeSingle();
  if (existing.error) throw existing.error;
  let rider = existing.data;

  if (!rider) {
    if (!isNameAllowed(displayName)) return errorResponse(400, 'Please pick a different display name.', 'NAME_NOT_ALLOWED');
    const ins = await db()
      .from('riders')
      .upsert({ phone, display_name: displayName }, { onConflict: 'phone', ignoreDuplicates: true })
      .select('id,display_name')
      .maybeSingle();
    if (ins.error) throw ins.error;
    rider = ins.data;
    if (!rider) {
      // Lost a race with a concurrent signup for the same phone: use the stored row.
      const again = await db().from('riders').select('id,display_name').eq('phone', phone).single();
      if (again.error) throw again.error;
      rider = again.data;
    }
  }

  await setRiderSession(rider.id);
  const res: CreateRiderResponse = { rider: { id: rider.id, displayName: rider.display_name } };
  return Response.json(res, { status: 201 });
});
