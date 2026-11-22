import { z } from "zod";
import { ClaimCode } from "@cb/shared";
import { rewardCatalog } from "./reward-catalog";

export const RewardInfo = z.object({
  id: z.string(),
  title: z.string(),
  offer: z.string(),
  merchant: z.string(),
  description: z.string(),
  demo: z.literal(true),
});
export type RewardInfo = z.infer<typeof RewardInfo>;
/** Ranked winner gets a keepsake even after a short run; higher scores reveal coupon concepts. */
export function rewardForScore(score: number): RewardInfo {
  const coupon = rewardCatalog
    .filter((r) => r.station === "bu-central" && r.points <= score)
    .sort((a, b) => b.points - a.points)[0];
  return coupon
    ? {
        id: coupon.id,
        title: coupon.title,
        offer: coupon.offer,
        merchant: coupon.place,
        description: coupon.detail,
        demo: true,
      }
    : {
        id: "boston-keepsake",
        title: "Boston city keepsake",
        offer: "CAR CHAMPION",
        merchant: "Boston Surfers crew",
        description:
          "A Boston souvenir sticker from the crew. UNO Q confirms the claim with its green LED.",
        demo: true,
      };
}
export type RewardClaimRow = {
  id: string;
  code: string;
  rider_id: string;
  car_id: string;
  score: number;
  expires_at: string;
  redeemed_at: string | null;
  dispense_status: string | null;
};
export const REWARD_SELECT =
  "id,code,rider_id,car_id,score,expires_at,redeemed_at,dispense_status";
export function rewardState(
  claim: Pick<RewardClaimRow, "redeemed_at" | "dispense_status" | "expires_at">,
  now: number,
) {
  if (claim.redeemed_at)
    return claim.dispense_status === "done"
      ? "complete"
      : claim.dispense_status === "error"
        ? "hardware_error"
        : "processing";
  return Date.parse(claim.expires_at) <= now ? "expired" : "pending";
}
export const RewardClaimView = z.object({
  code: ClaimCode,
  payload: z.string(),
  expiresAt: z.string(),
  carId: z.string(),
  score: z.number(),
  reward: RewardInfo,
});
export const RewardStatus = z.object({
  state: z.enum([
    "pending",
    "processing",
    "complete",
    "hardware_error",
    "expired",
  ]),
  reward: RewardInfo,
  expiresAt: z.string(),
});
export const RewardRedemption = z.object({
  state: z.enum(["complete", "already_complete", "hardware_error"]),
  reward: RewardInfo,
  code: ClaimCode,
  mode: z.string().nullable(),
  detail: z.string().optional(),
});
export type RewardRedemption = z.infer<typeof RewardRedemption>;
