import { CarIdParams } from '@cb/shared';
import { notImplemented, parseObject } from '@/lib/http';

/** GET /api/cars/:carId/join-token (kiosk) → JoinTokenResponse. Refetched every 25 s. */
export async function GET(_req: Request, ctx: { params: Promise<{ carId: string }> }) {
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  // TODO: requireKiosk(req); createJoinToken(carId, SESSION_SECRET); joinUrl(NEXT_PUBLIC_APP_URL, ...).
  return notImplemented();
}
