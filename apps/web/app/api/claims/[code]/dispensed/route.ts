import { ClaimCodeParams, DispensedRequest, type OkResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';

/** POST /api/claims/:code/dispensed (kiosk) { status, detail? } → { ok }. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, ClaimCodeParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, DispensedRequest);
  if (!body.ok) return body.response;
  if (body.data.detail) console.info(`[dispense] ${params.data.code} ${body.data.status}: ${body.data.detail}`);

  const { data, error } = await db()
    .from('claims')
    .update({ dispense_status: body.data.status })
    .eq('code', params.data.code)
    .not('redeemed_at', 'is', null)
    .select('id');
  if (error) throw error;
  if (!data?.length) return errorResponse(404, 'no redeemed claim with that code', 'NO_CLAIM');
  return Response.json({ ok: true } satisfies OkResponse);
});
