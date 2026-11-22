import { z } from "zod";
export const MobileHistory = z.object({
  runs: z.array(
    z.object({
      id: z.string(),
      score: z.number().nullable(),
      coins: z.number().nullable(),
      duration_ms: z.number().nullable(),
      finished_at: z.string().nullable(),
      car_id: z.string(),
      status: z.string(),
    }),
  ),
  rewards: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      score: z.number(),
      car_id: z.string(),
      created_at: z.string(),
      expires_at: z.string(),
      redeemed_at: z.string().nullable(),
      dispense_status: z.string().nullable(),
    }),
  ),
});
export type MobileHistory = z.infer<typeof MobileHistory>;
