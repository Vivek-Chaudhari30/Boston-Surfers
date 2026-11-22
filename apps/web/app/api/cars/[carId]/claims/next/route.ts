import { CarIdParams, DAILY_CHANNEL, carChannel } from '@cb/shared';
import { db } from '@/lib/db';
import { handle, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { broadcastChanged } from '@/lib/realtime';
import { dispenseIdFromClaimId } from '@/lib/tokens';

/**
 * POST /api/cars/:carId/claims/next (kiosk) → { ok: true, code, displayName, score, dispenseId } | { ok: false }.
 * Auto-voucher: when the car leader taps "I'm leaving", the kiosk redeems the newest pending claim
 * for its car by itself and sends DISPENSE <dispenseId> to the Arduino. No code typing or camera needed.
 * Atomic like /api/claims/redeem: only one request can flip redeemed_at from null.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const { carId } = params.data;
  const nowIso = new Date().toISOString();

  const { data: pending, error } = await db()
    .from('claims')
    .select('id,code,score')
    .eq('car_id', carId)
    .is('redeemed_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pending) return Response.json({ ok: false });

  const { data: won, error: upErr } = await db()
    .from('claims')
    .update({ redeemed_at: nowIso })
    .eq('id', pending.id)
    .is('redeemed_at', null)
    .select('id,code,score,riders(display_name)');
  if (upErr) throw upErr;
  const claim = won?.[0];
  if (!claim) return Response.json({ ok: false });

  const rider = (Array.isArray(claim.riders) ? claim.riders[0] : claim.riders) as { display_name: string } | undefined;
  void broadcastChanged(carChannel(carId), 'claim_redeemed');
  void broadcastChanged(DAILY_CHANNEL, 'daily');
  return Response.json({
    ok: true,
    code: claim.code as string,
    displayName: rider?.display_name ?? 'Rider',
    score: claim.score as number,
    dispenseId: dispenseIdFromClaimId(claim.id),
  });
});
