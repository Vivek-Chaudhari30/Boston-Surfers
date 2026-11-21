# @cb/game

Phaser runner played on riders' phones. **Owned by Jeet.**

What's here now is a **stub**: a canvas that says "Tap to score". Each tap adds 10 points, and the run ends after 10 s by calling `onGameOver`. Vivek builds `/play/run` and `/dev/game` against it until the real game lands (IP2, H12).

**Replace the stub, but keep the signature** (ARCHITECTURE §6, frozen):

```ts
export interface RunResult { score: number; coins: number; durationMs: number; distance: number }
export interface RunnerOptions {
  seed: number;
  theme?: { lineColor: string };
  onScoreChange?: (score: number) => void;
  onGameOver: (result: RunResult) => void;
}
export function createRunner(parent: HTMLElement, opts: RunnerOptions): { destroy(): void; restart(seed: number): void };
```

- Read the game rules (`GAME`, `MAX_SCORE_PER_SEC`) from `@cb/shared`. The server rejects scores above them.
- Don't import React or Next here. The web app loads this package client-only.
- Keep `touch-action: none` on the canvas (iOS Safari).
- Test it at `http://localhost:3000/dev/game` (no env vars needed). Phones on the same Wi-Fi: `pnpm dev --hostname 0.0.0.0`.

Layout: `src/index.ts` (createRunner), `src/types.ts` (contract), `src/config.ts`, `src/scenes/`.
