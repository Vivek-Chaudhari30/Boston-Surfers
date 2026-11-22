import type { RunResult } from "@cb/game";
import { z } from "zod";
const Practice = z.object({
  id: z.string(),
  at: z.number(),
  score: z.number().nonnegative(),
  coins: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  distance: z.number().nonnegative(),
});
export type PersonalPractice = z.infer<typeof Practice>;
const KEY = "cb:mobile:practice:v1";
export function readPersonalPractice(): PersonalPractice[] {
  try {
    return z
      .array(Practice)
      .parse(JSON.parse(localStorage.getItem(KEY) ?? "[]"))
      .slice(0, 50);
  } catch {
    return [];
  }
}
export function savePersonalPractice(run: RunResult) {
  const saved = {
    ...run,
    id:
      crypto.randomUUID?.() ??
      `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
  };
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([saved, ...readPersonalPractice()].slice(0, 50)),
    );
  } catch {
    /* Session play works without storage. */
  }
  return saved;
}
