import { rewardCatalog } from "./reward-catalog";

/** Public, illustrative coupons. CBD1 can never authorize a real CB1 reward or a hardware action. */
export const DEMO_REWARD_PREFIX = "CBD1:";
export const DEMO_OFFERS = [
  { key: "P1", prefix: "COFFEE", reward: rewardCatalog[0] },
  { key: "N1", prefix: "NOODLES", reward: rewardCatalog[1] },
  { key: "B1", prefix: "BITES", reward: rewardCatalog[2] },
] as const;
export type DemoReward = {
  payload: string;
  id: string;
  promoCode: string;
  offer: string;
  merchant: string;
  address: string;
  description: string;
};
export function decodeDemoReward(payload: string): DemoReward | null {
  const match = /^CBD1:([A-Z][0-9]):([0-9A-F]{8})$/.exec(payload.trim());
  if (!match) return null;
  const selected = DEMO_OFFERS.find((offer) => offer.key === match[1]);
  if (!selected) return null;
  const id = match[2]!;
  return {
    payload: `CBD1:${selected.key}:${id}`,
    id,
    promoCode: `BOS-${selected.prefix}-${id}`,
    offer: selected.reward.offer,
    merchant: selected.reward.place,
    address: selected.reward.address,
    description: selected.reward.detail,
  };
}
export function createDemoReward(): DemoReward {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const selected = DEMO_OFFERS[bytes[0]! % DEMO_OFFERS.length]!;
  const id = Array.from(bytes.slice(1), (value) =>
    value.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return decodeDemoReward(`CBD1:${selected.key}:${id}`)!;
}
