import Link from 'next/link';
import { DailyBoard } from '@/components/map/DailyBoard';
import { LineLegend } from '@/components/map/LineLegend';
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
          <Panel title="Live map">
            <LiveMap />
            <div className="mt-3">
              <LineLegend />
            </div>
          </Panel>
          <Panel title="Today's leaders">
            <DailyBoard />
          </Panel>
        </div>
        <section aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
          {[
            ['1 · Scan', 'Scan the QR on the kiosk in your train car.'],
            ['2 · Play', 'Run the track on your phone. Beat your car.'],
            ['3 · Win a sticker', 'Top the car board, then tap I’m getting off to claim.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-hud-border bg-hud-panel/80 p-4">
              <h3 className="font-mono text-sm uppercase tracking-[0.15em]">{t}</h3>
              <p className="mt-1 text-sm text-hud-dim">{d}</p>
            </div>
          ))}
        </section>
        <footer className="pb-2 text-center font-mono text-xs text-hud-dim">
          Built for BostonHacks 2026 · Constant Buffers
        </footer>
      </div>
    </main>
  );
}
