import { DAILY_CHANNEL, RedeemClaimRequest, carChannel, type RedeemClaimResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { rateLimit } from '@/lib/rate-limit';
import { broadcastChanged } from '@/lib/realtime';
import { dispenseIdFromClaimId } from '@/lib/tokens';

/** POST /api/claims/redeem (kiosk) { code, carId } → { ok, displayName, dispenseId } | { ok: false, reason }. */
export const POST = handle(async (req: Request) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const body = await parseBody(req, RedeemClaimRequest);
  if (!body.ok) return body.response;
  const { code, carId } = body.data;
  if (!rateLimit('redeem', carId).ok) return errorResponse(429, 'too many redeem attempts', 'RATE_LIMITED');

  const nowIso = new Date().toISOString();
  // Atomic: only one request can flip redeemed_at from null.
  const { data: won, error } = await db()
    .from('claims')
    .update({ redeemed_at: nowIso })
    .eq('code', code)
    .eq('car_id', carId)
    .is('redeemed_at', null)
    .gt('expires_at', nowIso)
    .select('id,riders(display_name)');
  if (error) throw error;

  const claim = won?.[0];
  if (claim) {
    const rider = (Array.isArray(claim.riders) ? claim.riders[0] : claim.riders) as { display_name: string } | undefined;
    void broadcastChanged(carChannel(carId), 'claim_redeemed');
    void broadcastChanged(DAILY_CHANNEL, 'daily');
    return Response.json({
      ok: true,
      displayName: rider?.display_name ?? 'Rider',
      dispenseId: dispenseIdFromClaimId(claim.id),
    } satisfies RedeemClaimResponse);
  }

  // Work out why it failed.
  const { data: c } = await db().from('claims').select('car_id,redeemed_at,expires_at').eq('code', code).maybeSingle();
  const reason: Extract<RedeemClaimResponse, { ok: false }>['reason'] = !c
    ? 'invalid'
    : c.car_id !== carId
      ? 'wrong_car'
      : c.redeemed_at
        ? 'used'
        : 'expired';
  return Response.json({ ok: false, reason } satisfies RedeemClaimResponse);
});
