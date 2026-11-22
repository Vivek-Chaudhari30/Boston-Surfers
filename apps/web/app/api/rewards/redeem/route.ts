import {
  ClaimCodeParams,
  RedeemClaimResponse,
  KIOSK_KEY_HEADER,
} from "@cb/shared";
import { db } from "@/lib/db";
import { errorResponse, handle, parseBody } from "@/lib/http";
import { requireKiosk } from "@/lib/kiosk-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  REWARD_SELECT,
  rewardForScore,
  rewardState,
  type RewardClaimRow,
} from "@/lib/reward-claim";
import { dispenseIdFromClaimId } from "@/lib/tokens";
import { confirmNativeReward } from "@/lib/adapters/dispenser/native-reward";
import { POST as reserveRankedClaim } from "@/app/api/claims/redeem/route";

// Serialize the same claim in this kiosk process, including browser retries during a slow request.
const inFlight = new Map<string, Promise<Response>>();
async function redeem(req: Request, claim: RewardClaimRow): Promise<Response> {
  const reward = rewardForScore(claim.score);
  const state = rewardState(claim, Date.now());
  const answer = (data: object) =>
    Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (state === "complete")
    return answer({
      state: "already_complete",
      code: claim.code,
      reward,
      mode: null,
    });
  if (state === "expired")
    return errorResponse(410, "This reward QR has expired.", "CLAIM_EXPIRED");
  if (state === "pending") {
    // Reuse the existing atomic, kiosk-authenticated, one-time ranked claim reservation.
    const reserved = await reserveRankedClaim(
      new Request(req.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [KIOSK_KEY_HEADER]: req.headers.get(KIOSK_KEY_HEADER) ?? "",
        },
        body: JSON.stringify({ code: claim.code, carId: claim.car_id }),
      }),
    );
    if (!reserved.ok) return reserved;
    const result = RedeemClaimResponse.parse(await reserved.json());
    if (!result.ok)
      return errorResponse(
        409,
        `Claim cannot be redeemed: ${result.reason}.`,
        "CLAIM_UNAVAILABLE",
      );
  }
  // The board is reached from the Mac's Next server, not from the phone or cloud deployment.
  const confirmation = await confirmNativeReward(
    dispenseIdFromClaimId(claim.id),
  );
  const { error } = await db()
    .from("claims")
    .update({ dispense_status: confirmation.ok ? "done" : "error" })
    .eq("id", claim.id)
    .not("redeemed_at", "is", null)
    .or("dispense_status.is.null,dispense_status.eq.error"); // An error/retry must never overwrite a completed claim.
  if (error) throw error;
  return answer({
    state: confirmation.ok ? "complete" : "hardware_error",
    code: claim.code,
    reward,
    mode: confirmation.ok ? confirmation.mode : null,
    ...(!confirmation.ok ? { detail: confirmation.error } : {}),
  });
}
export const POST = handle(async (req: Request) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const parsed = await parseBody(req, ClaimCodeParams);
  if (!parsed.ok) return parsed.response;
  const code = parsed.data.code;
  if (!rateLimit("redeem", `reward:${code}`).ok)
    return errorResponse(
      429,
      "Please wait a moment before rescanning.",
      "RATE_LIMITED",
    );
  const existing = inFlight.get(code);
  if (existing) return (await existing).clone();
  const operation = (async () => {
    const { data, error } = await db()
      .from("claims")
      .select(REWARD_SELECT)
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return errorResponse(
        404,
        "This is not a valid ranked reward claim.",
        "NO_CLAIM",
      );
    return redeem(req, data as RewardClaimRow);
  })();
  inFlight.set(code, operation);
  try {
    return (await operation).clone();
  } finally {
    inFlight.delete(code);
  }
});
