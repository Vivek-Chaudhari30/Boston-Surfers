// Server-side UNO Q transport. Only an authenticated claim handler may invoke this.
import { isValidDispenseId } from "@cb/shared";
export async function confirmNativeReward(
  id: string,
): Promise<{ ok: true; mode: string | null } | { ok: false; error: string }> {
  if (!isValidDispenseId(id))
    return { ok: false, error: "Invalid device reward id." };
  let error = "Arduino did not confirm the reward.";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(
        `${process.env.UNOQ_URL || "http://127.0.0.1:8765"}/api/reward`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        },
      );
      const value: unknown = await response.json();
      if (
        value &&
        typeof value === "object" &&
        "id" in value &&
        value.id === id &&
        "ok" in value &&
        value.ok === true &&
        response.ok
      ) {
        return {
          ok: true,
          mode:
            "mode" in value && typeof value.mode === "string"
              ? value.mode
              : null,
        };
      }
      error =
        "Arduino could not complete the reward. Check its USB connection.";
    } catch {
      error =
        "Arduino is unavailable. Keep the USB connected and retry this claim.";
    }
  }
  return { ok: false, error };
}
