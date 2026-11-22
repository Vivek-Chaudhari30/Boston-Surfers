import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  deny: vi.fn(),
  from: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  reserve: vi.fn(),
  board: vi.fn(),
  or: vi.fn(),
}));
vi.mock("@/lib/kiosk-auth", () => ({ requireKiosk: mocks.deny }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/db", () => ({ db: () => ({ from: mocks.from }) }));
vi.mock("@/lib/adapters/dispenser/native-reward", () => ({
  confirmNativeReward: mocks.board,
}));
vi.mock("@/app/api/claims/redeem/route", () => ({ POST: mocks.reserve }));
import { POST } from "./route";
const row = {
  id: "aabb1122-1111-4444-8888-123456789abc",
  code: "ABC234",
  rider_id: "owner",
  car_id: "green-3812",
  score: 70,
  expires_at: "2099-01-01T00:00:00.000Z",
  redeemed_at: null,
  dispense_status: null,
};
const request = () =>
  new Request("http://localhost/api/rewards/redeem", {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiosk-key": "test-key" },
    body: JSON.stringify({ code: "ABC234" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockReturnValue(null);
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    maybeSingle: mocks.read,
    update: mocks.update,
    or: mocks.or,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  mocks.update.mockReturnValue(chain);
  mocks.or.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue(chain);
  mocks.read.mockResolvedValue({ data: { ...row }, error: null });
  mocks.reserve.mockImplementation(async () =>
    Response.json({ ok: true, displayName: "Rider", dispenseId: "aabb1122" }),
  );
  mocks.board.mockResolvedValue({ ok: true, mode: "led-only" });
});
describe("ranked claim → UNO Q confirmation", () => {
  it("rejects an unauthorized kiosk before reading claims or touching the Arduino", async () => {
    mocks.deny.mockReturnValue(
      Response.json({ error: "unauthorized" }, { status: 401 }),
    );
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.board).not.toHaveBeenCalled();
  });
  it("rejects missing and expired claims without a physical reward", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(request())).status).toBe(404);
    mocks.read.mockResolvedValueOnce({
      data: { ...row, expires_at: "2000-01-01T00:00:00Z" },
      error: null,
    });
    expect((await POST(request())).status).toBe(410);
    expect(mocks.board).not.toHaveBeenCalled();
  });
  it("reserves the server claim and marks completion only after the board responds", async () => {
    expect(await (await POST(request())).json()).toMatchObject({
      state: "complete",
      mode: "led-only",
      reward: { id: "boston-keepsake" },
    });
    const forwarded = mocks.reserve.mock.calls[0]![0] as Request;
    expect(await forwarded.json()).toEqual({
      code: "ABC234",
      carId: "green-3812",
    });
    expect(mocks.board).toHaveBeenCalledWith("aabb1122");
    expect(mocks.update).toHaveBeenCalledWith({ dispense_status: "done" });
    expect(mocks.or).toHaveBeenCalledWith(
      "dispense_status.is.null,dispense_status.eq.error",
    );
  });
  it("does not re-award an already completed code", async () => {
    mocks.read.mockResolvedValue({
      data: {
        ...row,
        redeemed_at: "2026-11-21T20:00:00Z",
        dispense_status: "done",
      },
      error: null,
    });
    expect(await (await POST(request())).json()).toMatchObject({
      state: "already_complete",
    });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.board).not.toHaveBeenCalled();
  });
  it("retries a hardware failure with the same id without another reservation", async () => {
    mocks.read.mockResolvedValue({
      data: {
        ...row,
        redeemed_at: "2026-11-21T20:00:00Z",
        dispense_status: "error",
      },
      error: null,
    });
    mocks.board.mockResolvedValueOnce({ ok: false, error: "USB disconnected" });
    expect(await (await POST(request())).json()).toMatchObject({
      state: "hardware_error",
    });
    expect(await (await POST(request())).json()).toMatchObject({
      state: "complete",
    });
    expect(mocks.board.mock.calls).toEqual([["aabb1122"], ["aabb1122"]]);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("coalesces simultaneous scans into one board request", async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(await responses[0]!.json()).toMatchObject({ state: "complete" });
    expect(await responses[1]!.json()).toMatchObject({ state: "complete" });
    expect(mocks.board).toHaveBeenCalledTimes(1);
  });
});
