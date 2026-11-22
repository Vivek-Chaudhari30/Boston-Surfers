import { ClaimCodeParams } from "@cb/shared";
import { db } from "@/lib/db";
import { errorResponse, handle, parseObject } from "@/lib/http";
import { getRiderSession } from "@/lib/session";
import {
  REWARD_SELECT,
  rewardForScore,
  rewardState,
  type RewardClaimRow,
} from "@/lib/reward-claim";
export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const session = await getRiderSession();
    if (!session)
      return errorResponse(401, "Sign in to see your claim.", "NO_SESSION");
    const parsed = parseObject(await ctx.params, ClaimCodeParams);
    if (!parsed.ok) return parsed.response;
    const { data, error } = await db()
      .from("claims")
      .select(REWARD_SELECT)
      .eq("code", parsed.data.code)
      .eq("rider_id", session.riderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return errorResponse(404, "Claim not found.", "NO_CLAIM");
    const claim = data as RewardClaimRow;
    return Response.json(
      {
        state: rewardState(claim, Date.now()),
        reward: rewardForScore(claim.score),
        expiresAt: claim.expires_at,
      },
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  },
);
