import { CarIdParams, type JoinTokenResponse } from '@cb/shared';
import { serverEnv } from '@/lib/env';
import { errorResponse, handle, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { getCar } from '@/lib/queries';
import { createJoinToken, joinUrl } from '@/lib/tokens';

/**
 * Base URL for the QR. Uses NEXT_PUBLIC_APP_URL, except when that is localhost: then the
 * request's own origin, so a kiosk opened at http://<mac-ip>:3000 gives phones a reachable URL.
 */
function appOrigin(req: Request): string {
  const configured = serverEnv().NEXT_PUBLIC_APP_URL;
  const host = new URL(configured).hostname;
  return host === 'localhost' || host === '127.0.0.1' ? new URL(req.url).origin : configured;
}

/** GET /api/cars/:carId/join-token (kiosk) → { token, url, expiresAt }. Refetch every 25 s. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  if (!(await getCar(params.data.carId))) return errorResponse(404, 'unknown car', 'NO_CAR');

  const { token, expiresAt } = createJoinToken(params.data.carId, serverEnv().SESSION_SECRET);
  const res: JoinTokenResponse = {
    token,
    url: joinUrl(appOrigin(req), params.data.carId, token),
    expiresAt: expiresAt.toISOString(),
  };
  return Response.json(res, { headers: { 'cache-control': 'no-store' } });
});
