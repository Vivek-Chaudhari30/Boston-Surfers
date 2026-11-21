import { GameHarnessLoader } from './GameHarnessLoader';

/** Game harness for @cb/game. Needs no env vars. */
export default function DevGamePage() {
  return (
    <main className="min-h-dvh"><GameHarnessLoader /></main>
  );
}
