import { ClaimCodeParams } from '@cb/shared';
import { notImplemented, parseObject } from '@/lib/http';

/** GET /api/claims/:code → ClaimStatusResponse. The phone polls every 2 s. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const params = parseObject(await ctx.params, ClaimCodeParams);
  if (!params.ok) return params.response;
  // TODO: only the claim's own rider may read it.
  return notImplemented();
}
