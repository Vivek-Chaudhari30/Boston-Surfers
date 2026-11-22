import { db } from "@/lib/db";
import { errorResponse, handle } from "@/lib/http";
import { getRiderSession } from "@/lib/session";
import { MobileHistory } from "@/lib/mobile-history";

/** Identity comes only from the signed cookie, never a rider id supplied by a client. */
export const GET = handle(async () => {
  const session = await getRiderSession();
  if (!session)
    return errorResponse(
      401,
      "Sign in to see your personal history.",
      "NO_SESSION",
    );
  const [runs, rewards] = await Promise.all([
    db()
      .from("runs")
      .select("id,score,coins,duration_ms,finished_at,car_id,status")
      .eq("rider_id", session.riderId)
      .in("status", ["finished", "rejected"])
      .order("finished_at", { ascending: false })
      .limit(50),
    db()
      .from("claims")
      .select(
        "id,code,score,car_id,created_at,expires_at,redeemed_at,dispense_status",
      )
      .eq("rider_id", session.riderId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (runs.error) throw runs.error;
  if (rewards.error) throw rewards.error;
  const data = MobileHistory.parse({
    runs: runs.data ?? [],
    rewards: rewards.data ?? [],
  });
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
});
