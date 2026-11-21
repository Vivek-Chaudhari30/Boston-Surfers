import { CreateRiderRequest, type CreateRiderResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { setRiderSession } from '@/lib/session';

/** POST /api/riders → 201 { rider }. Sets cb_rider. A known phone returns that rider (name updated). */
export const POST = handle(async (req: Request) => {
  const rl = rateLimit('signup', clientIp(req));
  if (!rl.ok) return errorResponse(429, 'too many signups, slow down', 'RATE_LIMITED');
  const body = await parseBody(req, CreateRiderRequest);
  if (!body.ok) return body.response;
  const { phone, displayName } = body.data;

  const { data, error } = await db()
    .from('riders')
    .upsert({ phone, display_name: displayName }, { onConflict: 'phone' })
    .select('id,display_name')
    .single();
  if (error) throw error;

  await setRiderSession(data.id);
  const res: CreateRiderResponse = { rider: { id: data.id, displayName: data.display_name } };
  return Response.json(res, { status: 201 });
});
