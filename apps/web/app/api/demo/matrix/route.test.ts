import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const hardware = vi.hoisted(() => vi.fn());
vi.mock("@/lib/adapters/dispenser/native-reward", () => ({
  confirmNativeReward: hardware,
}));
import { GET, POST } from "./route";
function req(
  host = "localhost:3001",
  origin = "http://localhost:3001",
  payload = "CBD1:P1:1234ABCD",
) {
  return new Request("http://" + host + "/api/demo/matrix", {
    method: "POST",
    headers: { host, origin, "content-type": "application/json" },
    body: JSON.stringify({ payload, requestId: "abcdef123456" }),
  });
}
beforeEach(() => {
  vi.stubEnv("UNOQ_MATRIX_DEMO", "1");
  hardware.mockReset();
  hardware.mockResolvedValue({ ok: true, mode: "matrix-only" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("local demo winning QR → matrix", () => {
  it("keeps the hardware endpoint disabled on deployments without explicit local opt-in", async () => {
    vi.stubEnv("UNOQ_MATRIX_DEMO", "");
    expect((await POST(req())).status).toBe(403);
    expect(hardware).not.toHaveBeenCalled();
  });
  it("rejects public hosts and foreign browser origins before touching the USB board", async () => {
    expect((await POST(req("constant-buffers.vercel.app"))).status).toBe(403);
    expect(
      (await POST(req("localhost:3001", "https://other.example"))).status,
    ).toBe(403);
    expect(hardware).not.toHaveBeenCalled();
  });
  it("never treats a ranked claim or camera diagnostic as an anonymous matrix demo", async () => {
    for (const payload of ["CB1:ABC234", "CB-CAMERA-CHECK", "CBD1:X1:1234ABCD"])
      expect(
        (await POST(req("localhost:3001", "http://localhost:3001", payload)))
          .status,
      ).toBe(400);
    expect(hardware).not.toHaveBeenCalled();
  });
  it("uses a stable request id for physical retries and confirms the matrix acknowledgement", async () => {
    expect(await (await POST(req())).json()).toEqual({
      ok: true,
      mode: "matrix-only",
    });
    expect(hardware).toHaveBeenCalledWith("abcdef123456");
  });
  it("does not report a single-LED acknowledgement as a matrix animation", async () => {
    hardware.mockResolvedValue({ ok: true, mode: "led-only" });
    expect((await POST(req())).status).toBe(503);
  });
  it("reports disconnected hardware without falsely claiming completion", async () => {
    hardware.mockResolvedValue({ ok: false, error: "USB disconnected" });
    expect((await POST(req())).status).toBe(503);
  });
  it("checks matrix status without sending an animation command", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ connected: true, mode: "matrix-only" }),
    );
    expect(
      await (
        await GET(new Request("http://localhost:3001/api/demo/matrix"))
      ).json(),
    ).toEqual({ enabled: true, connected: true });
    expect(hardware).not.toHaveBeenCalled();
  });
});
