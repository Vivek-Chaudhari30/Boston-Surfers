import { describe, expect, it } from "vitest";
import { createDemoReward, decodeDemoReward } from "./demo-reward";
import { codeFromQr } from "./adapters/rider-input/claim-code";

describe("presentation coupon QR", () => {
  it("reveals the same promo on different devices without a database or shared browser storage", () => {
    const payload = "CBD1:P1:A1B2C3D4";
    expect(decodeDemoReward(payload)).toMatchObject({
      merchant: "Pavement Coffeehouse · BU",
      offer: "15% OFF",
      promoCode: "BOS-COFFEE-A1B2C3D4",
    });
    expect(decodeDemoReward(payload)).toEqual(decodeDemoReward(payload));
  });
  it("recognizes every demo award offered by the phone", () => {
    expect(decodeDemoReward("CBD1:N1:1234ABCD")).toMatchObject({
      offer: "$3 OFF",
      merchant: "Nud Pob Thai Cuisine",
    });
    expect(decodeDemoReward("CBD1:B1:1234ABCD")).toMatchObject({
      offer: "10% OFF",
      merchant: "Beijing Cafe",
    });
  });
  it("rejects unknown offers, malformed data, embedded markup and oversized tokens", () => {
    for (const data of [
      "CBD1:X1:1234ABCD",
      "CBD1:P1:12",
      "CBD1:P1:<script>",
      "CBD1:P1:1234ABCD:extra",
      "CBD1:P1:" + "A".repeat(10000),
    ])
      expect(decodeDemoReward(data)).toBeNull();
  });
  it("never confuses a demo coupon with a real ranked claim or camera diagnostic", () => {
    expect(codeFromQr("CBD1:P1:1234ABCD")).toBeNull();
    expect(decodeDemoReward("CB1:ABC234")).toBeNull();
    expect(decodeDemoReward("CB-CAMERA-CHECK")).toBeNull();
  });
  it("creates a random, fully decodable offer without using rider identity or scores", () => {
    const reward = createDemoReward();
    expect(reward.payload).toMatch(/^CBD1:(P1|N1|B1):[0-9A-F]{8}$/);
    expect(decodeDemoReward(reward.payload)).toEqual(reward);
    expect(reward.promoCode).toMatch(
      /^BOS-(COFFEE|NOODLES|BITES)-[0-9A-F]{8}$/,
    );
  });
});
