import { RedeemClaimRequest } from '@cb/shared';
import { notImplemented, parseBody } from '@/lib/http';

/** POST /api/claims/redeem (kiosk) → RedeemClaimResponse. */
export async function POST(req: Request) {
  const body = await parseBody(req, RedeemClaimRequest);
  if (!body.ok) return body.response;
  // TODO: requireKiosk(req); rateLimit('redeem'); check expiry/car/used atomically; dispenseIdFromClaimId; broadcast claim_redeemed.
  return notImplemented();
}
