import { ClaimCodeParams } from "@cb/shared";
import { db } from "@/lib/db";
import { errorResponse, handle, parseBody } from "@/lib/http";
import { getRiderSession } from "@/lib/session";
import {
  REWARD_SELECT,
  rewardForScore,
  rewardState,
  type RewardClaimRow,
} from "@/lib/reward-claim";

/** Read the signed-in rider's actual ranked winner claim. Never issue from browser scores. */
export const POST = handle(async (req: Request) => {
  const session = await getRiderSession();
  if (!session)
    return errorResponse(
      401,
      "Sign in to see your reward claim.",
      "NO_SESSION",
    );
  const parsed = await parseBody(req, ClaimCodeParams);
  if (!parsed.ok) return parsed.response;
  const { data, error } = await db()
    .from("claims")
    .select(REWARD_SELECT)
    .eq("code", parsed.data.code)
    .eq("rider_id", session.riderId)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    return errorResponse(
      404,
      "No reward claim belongs to you with that code.",
      "NO_CLAIM",
    );
  const claim = data as RewardClaimRow;
  const state = rewardState(claim, Date.now());
  if (state !== "pending")
    return errorResponse(
      409,
      state === "expired"
        ? "This reward QR expired."
        : "This claim has already been scanned.",
      "CLAIM_NOT_PENDING",
    );
  // QR is a one-time database reference. Reward data is fetched from the server, never trusted from a QR or phone score.
  return Response.json(
    {
      code: claim.code,
      payload: `CB1:${claim.code}`,
      expiresAt: claim.expires_at,
      carId: claim.car_id,
      score: claim.score,
      reward: rewardForScore(claim.score),
    },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
});
