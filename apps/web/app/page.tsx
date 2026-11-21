import Link from 'next/link';
import { DailyBoard } from '@/components/map/DailyBoard';
import { LiveMap } from '@/components/map/LiveMap';
import { LineBar, Panel } from '@/components/ui/Panel';

/** Website: live map + daily leaderboard. */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <LineBar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="hud-glow text-3xl font-semibold tracking-tight">Constant Buffers</h1>
            <p className="text-hud-dim">Every train on the T, live. Play on board, win your car.</p>
          </div>
          <nav className="flex gap-4 font-mono text-sm text-hud-dim">
            <Link href="/leaderboard">Leaderboard</Link>
          </nav>
        </header>
        <div className="grid flex-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Panel title="Live map" className="min-h-[60vh]">
            <LiveMap />
          </Panel>
          <Panel title="Today's leaders">
            <DailyBoard />
          </Panel>
        </div>
      </div>
    </main>
  );
}
