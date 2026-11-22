import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmNativeReward } from "./native-reward";
afterEach(() => vi.restoreAllMocks());
describe("native UNO Q acknowledgement", () => {
  it("does not send invalid ids to the board", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await confirmNativeReward("bad-id")).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires the board to acknowledge the exact same id", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ ok: true, id: "different", mode: "led-only" }),
    );
    expect(await confirmNativeReward("aabb1122")).toMatchObject({ ok: false });
  });
  it("retries with the same id and preserves LED-only mode", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("USB timeout"))
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          id: "aabb1122",
          duplicate: true,
          mode: "led-only",
        }),
      );
    expect(await confirmNativeReward("aabb1122")).toEqual({
      ok: true,
      mode: "led-only",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).id),
    ).toEqual(["aabb1122", "aabb1122"]);
  });
});
