import { describe, expect, it } from "vitest";
import { readPractice, recordPractice, type PracticeRun } from "./practice";
const run = (id: string, score: number, at = 1): PracticeRun => ({
  id,
  score,
  at,
  coins: 0,
  distance: score,
  durationMs: 5000,
});
describe("practice standings", () => {
  it("recovers from invalid or disabled-storage data without inventing scores", () => {
    expect(readPractice(null)).toEqual([]);
    expect(readPractice("{bad")).toEqual([]);
    expect(readPractice("{}")).toEqual([]);
    expect(
      readPractice(
        JSON.stringify([run("ok", 50), { ...run("bad", 10), score: -1 }, {}]),
      ),
    ).toEqual([run("ok", 50)]);
  });
  it("ranks real saved runs and keeps earlier ties first", () => {
    expect(
      recordPractice([run("a", 70, 1), run("b", 100, 2)], run("c", 100, 3)).map(
        (r) => r.id,
      ),
    ).toEqual(["b", "c", "a"]);
  });
  it("deduplicates IDs and bounds device history", () => {
    const history = Array.from({ length: 15 }, (_, i) => run(String(i), i));
    const ranked = recordPractice(history, run("14", 14));
    expect(ranked).toHaveLength(10);
    expect(ranked.filter((r) => r.id === "14")).toHaveLength(1);
    expect(ranked[0]?.score).toBe(14);
  });
});
