import Link from 'next/link';
import { LineBar, Panel, Placeholder } from '@/components/ui/Panel';

/** Website: live map + daily leaderboard. */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <LineBar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <header className="flex items-baseline justify-between">
          <h1 className="hud-glow text-3xl font-semibold tracking-tight">Constant Buffers</h1>
          <nav className="flex gap-4 font-mono text-sm text-hud-dim">
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/dev/game">/dev/game</Link>
            <Link href="/dev/dispenser">/dev/dispenser</Link>
          </nav>
        </header>
        <div className="grid flex-1 gap-6 md:grid-cols-[1.6fr_1fr]">
          <Panel title="Live map">
            <Placeholder>Spider-Tracker map: TODO</Placeholder>
          </Panel>
          <Panel title="Today's leaders">
            <Placeholder>Daily leaderboard: TODO</Placeholder>
          </Panel>
        </div>
      </div>
    </main>
  );
}
