import { ClaimCodeParams, type ClaimStatusResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseObject } from '@/lib/http';
import { getRiderSession } from '@/lib/session';

/** GET /api/claims/:code → { status }. Only the claim's own rider may read it. Phone polls every 2 s. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const params = parseObject(await ctx.params, ClaimCodeParams);
  if (!params.ok) return params.response;
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'sign up first', 'NO_SESSION');

  const { data, error } = await db()
    .from('claims')
    .select('rider_id,expires_at,redeemed_at')
    .eq('code', params.data.code)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.rider_id !== session.riderId) return errorResponse(404, 'claim not found', 'NO_CLAIM');

  const status: ClaimStatusResponse['status'] = data.redeemed_at
    ? 'redeemed'
    : Date.parse(data.expires_at) < Date.now()
      ? 'expired'
      : 'pending';
  return Response.json({ status } satisfies ClaimStatusResponse);
});
