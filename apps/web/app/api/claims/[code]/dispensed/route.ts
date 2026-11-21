import { ClaimCodeParams, DispensedRequest } from '@cb/shared';
import { notImplemented, parseBody, parseObject } from '@/lib/http';

/** POST /api/claims/:code/dispensed (kiosk) → OkResponse. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const params = parseObject(await ctx.params, ClaimCodeParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, DispensedRequest);
  if (!body.ok) return body.response;
  // TODO: requireKiosk(req); set dispense_status.
  return notImplemented();
}
