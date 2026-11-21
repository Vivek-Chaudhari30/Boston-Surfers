/**
 * @cb/game contract (ARCHITECTURE §6). FROZEN after hour 1.
 * Changing these requires both Vivek and Jeet to agree; update ARCHITECTURE.md in the same commit.
 */
export interface RunResult {
  score: number;
  coins: number;
  durationMs: number;
  distance: number;
}

export interface RunnerOptions {
  seed: number;
  theme?: { lineColor: string };
  onScoreChange?: (score: number) => void;
  onGameOver: (result: RunResult) => void;
}

export interface RunnerHandle {
  destroy(): void;
  restart(seed: number): void;
}
