import { z } from "zod";
import { decodeDemoReward } from "@/lib/demo-reward";
import { confirmNativeReward } from "@/lib/adapters/dispenser/native-reward";
import { errorResponse, handle, parseBody } from "@/lib/http";

function localOrigin(req: Request): URL | null {
  const url = new URL(req.url);
  url.host = req.headers.get("host") ?? url.host;
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? url
    : null;
}
const enabled = () => process.env.UNOQ_MATRIX_DEMO === "1";
export const GET = handle(async (req: Request) => {
  if (!enabled() || !localOrigin(req))
    return Response.json({ enabled: false, connected: false });
  try {
    const res = await fetch(
      `${process.env.UNOQ_URL || "http://127.0.0.1:8765"}/api/status`,
      { cache: "no-store", signal: AbortSignal.timeout(2500) },
    );
    const data: unknown = await res.json();
    const connected =
      res.ok &&
      typeof data === "object" &&
      data !== null &&
      "mode" in data &&
      data.mode === "matrix-only" &&
      "connected" in data &&
      data.connected === true;
    return Response.json(
      { enabled: true, connected },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { enabled: true, connected: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
});
const RequestBody = z.object({
  payload: z.string().max(128),
  requestId: z.string().regex(/^[A-Fa-f0-9]{12}$/),
});
export const POST = handle(async (req: Request) => {
  const origin = localOrigin(req);
  if (!enabled() || !origin)
    return errorResponse(
      403,
      "The USB matrix runs in the Mac kiosk at http://localhost:3001/kiosk/claim.",
      "LOCAL_MATRIX_ONLY",
    );
  if (req.headers.get("origin") && req.headers.get("origin") !== origin.origin)
    return errorResponse(
      403,
      "Open the local kiosk to use its USB display.",
      "BAD_ORIGIN",
    );
  const body = await parseBody(req, RequestBody);
  if (!body.ok) return body.response;
  if (!decodeDemoReward(body.data.payload))
    return errorResponse(400, "Not a demo winning QR.", "INVALID_DEMO_QR");
  const result = await confirmNativeReward(body.data.requestId);
  if (!result.ok) return errorResponse(503, result.error, "MATRIX_UNREACHABLE");
  if (result.mode !== "matrix-only")
    return errorResponse(
      503,
      "The LED matrix service is not running on the UNO Q.",
      "WRONG_DEVICE_MODE",
    );
  return Response.json(
    { ok: true, mode: result.mode },
    { headers: { "Cache-Control": "no-store" } },
  );
});
