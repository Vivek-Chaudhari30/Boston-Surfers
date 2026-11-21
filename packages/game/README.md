# @cb/game

Phaser runner played on riders' phones. **Owned by Jeet.**

The playable runner is implemented. It uses a perspective MBTA tunnel,
three tracks, low barriers (jump), overhead bars (duck), trains (change
lanes), coins, a speed ramp, and score/result callbacks. All art is drawn
with simple Phaser shapes; there are no external images or network requests.

**Public signature remains unchanged** (ARCHITECTURE §6, frozen):

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

## Try it

Open `http://localhost:3000/dev/game` while the development server is running.
Click **START RUN**. The canvas then has keyboard focus:

- Left/right arrows or A/D: change lanes.
- Up arrow, W, or Space: jump over orange barriers.
- Down arrow or S: duck under yellow overhead bars.
- Swipe in those same directions on a phone or trackpad-driven pointer.
- Four buttons at the bottom also control the runner.

Hitting a train always ends a run. Each course row leaves two lanes clear,
with a coin in one of the safe lanes. The first obstacle is 70 metres out
to provide time to learn the controls. A retry inside the game repeats the
same course. The harness's **restart(seed)** button chooses a fresh seed.
Line-color buttons remount with the selected accent color.

## Host integration

The course depends only on `seed`. Frame-rate differences change when
objects appear, but not their lanes, positions, types, or coin placements.
`RunnerHandle.restart(seed)` resets all run state; `destroy()` removes the
canvas/input handlers and restores scroll/touch styles. Scroll locks are
reference-counted when multiple runners are mounted.

Score is `floor(distance * GAME.SCORE_PER_METER) + coins * GAME.COIN_VALUE`.
All speed and scoring constants come from `@cb/shared`. The model ignores
large catch-up frames after suspension, caps coin density, and ends long
runs before the server's ten-minute expiry. `durationMs` measures active
simulation time. `onGameOver` reports one result per completed run.

This package never awards prizes or submits results. The parent app owns
server run IDs and must create a valid server run before every replay, or
show/navigate to its own results screen when `onGameOver` fires. Keep local
practice replays separate from ranked score submissions.

## Verification

`pnpm typecheck` and `pnpm test` pass (33 total workspace tests, including
eight new game tests). Game tests cover deterministic courses, lane bounds,
all collision types, jump/duck timing, safe-route coin collection, score
limits, and suspension handling.

Browser checks verified keyboard movement/jumping, swipe lane changes in
a 390 x 844 viewport, score/result delivery, the score validation ceiling,
theme changes, restart, one canvas after remounting, and restored scrolling.
This is a browser viewport test, not testing on physical iPhone/Android devices.

The production build was attempted but remains blocked by the scaffold's
Turbopack CSS worker error (`binding to a port: Operation not permitted`).
The development preview works. No files in `apps/web` or `packages/shared`
were changed for this game implementation.
