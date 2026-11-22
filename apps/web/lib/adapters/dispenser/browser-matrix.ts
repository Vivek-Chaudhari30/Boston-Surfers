// The deployed kiosk contacts the Mac's USB bridge directly, after a user click.
import { z } from "zod";
const BASE = "http://127.0.0.1:8765";
const Status = z.object({ connected: z.literal(true), mode: z.literal("matrix-only") });
const Reply = z.object({ ok: z.literal(true), id: z.string(), mode: z.literal("matrix-only") });
export async function browserMatrixStatus() {
  const response = await fetch(`${BASE}/api/status`, {
    cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("USB bridge is unavailable.");
  return Status.parse(await response.json());
}
export async function playBrowserMatrix(id: string) {
  if (!/^[a-f0-9]{12}$/.test(id)) throw new Error("Invalid animation ID.");
  const response = await fetch(`${BASE}/api/reward`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }), credentials: "omit", cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error("USB animation failed. Check the Arduino and retry.");
  const result = Reply.parse(await response.json());
  if (result.id !== id) throw new Error("Arduino acknowledgement did not match.");
  return result;
}
