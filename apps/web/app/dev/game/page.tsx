import { GameHarnessLoader } from './GameHarnessLoader';

/** Game harness for @cb/game. Needs no env vars. */
export default function DevGamePage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-4">
      <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-hud-dim">/dev/game</h1>
      <GameHarnessLoader />
    </main>
  );
}
