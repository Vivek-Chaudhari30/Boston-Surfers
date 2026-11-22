import { describe, expect, it } from "vitest";
import { rewardForScore, rewardState } from "./reward-claim";
const expires_at = "2026-11-21T23:00:00.000Z";
const now = Date.parse("2026-11-21T23:01:00.000Z");
describe("ranked reward metadata and completion", () => {
  it("derives reward details from the server score, with a short-run keepsake fallback", () => {
    expect(rewardForScore(70).id).toBe("boston-keepsake");
    expect(rewardForScore(250)).toMatchObject({
      id: "pavement-bu",
      demo: true,
    });
    expect(rewardForScore(500).id).toBe("nud-pob");
    expect(rewardForScore(900).id).toBe("beijing");
  });
  it("expires unscanned claims while preserving reserved claims for hardware recovery", () => {
    expect(
      rewardState(
        { expires_at, redeemed_at: null, dispense_status: null },
        now,
      ),
    ).toBe("expired");
    expect(
      rewardState(
        { expires_at, redeemed_at: expires_at, dispense_status: null },
        now,
      ),
    ).toBe("processing");
    expect(
      rewardState(
        { expires_at, redeemed_at: expires_at, dispense_status: "error" },
        now,
      ),
    ).toBe("hardware_error");
  });
  it("requires device acknowledgement before reporting completion", () => {
    expect(
      rewardState(
        { expires_at, redeemed_at: expires_at, dispense_status: "done" },
        now,
      ),
    ).toBe("complete");
    expect(
      rewardState(
        { expires_at, redeemed_at: null, dispense_status: "done" },
        now,
      ),
    ).toBe("expired");
  });
});
