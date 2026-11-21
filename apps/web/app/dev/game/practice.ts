import type { RunResult } from "@cb/game";

export type PracticeRun = RunResult & { id: string; at: number };
export const PRACTICE_KEY = "cb:comic-practice:v1";

export function readPractice(raw: string | null): PracticeRun[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is PracticeRun =>
          typeof v === "object" &&
          v !== null &&
          typeof v.id === "string" &&
          ["score", "coins", "durationMs", "distance", "at"].every(
            (k) =>
              typeof v[k] === "number" && Number.isFinite(v[k]) && v[k] >= 0,
          ),
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function recordPractice(
  previous: PracticeRun[],
  run: PracticeRun,
): PracticeRun[] {
  return [...previous.filter((r) => r.id !== run.id), run]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, 10);
}
