import Link from 'next/link';
import { LineLegend } from '@/components/map/LineLegend';
import { LiveMap } from '@/components/map/LiveMap';
import { HowItWorks } from '@/components/site/HowItWorks';
import { LeadersCard } from '@/components/site/LeadersCard';
import { TopBar } from '@/components/site/TopBar';

/** Website: full-bleed live map hero with floating HUD overlays, then how it works. */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <TopBar current="map" />
      <div className="relative">
        <div className="relative h-[70dvh] w-full overflow-hidden lg:h-[calc(100dvh-3rem)]">
          <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full">
            <LiveMap />
          </div>
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 lg:p-5">
            <div className="hud-glass pointer-events-auto max-w-sm self-start rounded-2xl px-4 py-3">
              <h1 className="hud-glow text-xl font-semibold tracking-tight lg:text-2xl">Constant Buffers</h1>
              <p className="mt-0.5 text-sm text-hud-dim">Every train on the T, live. Play on board, win your car.</p>
              <Link
                href="/leaderboard"
                className="mt-2 inline-block font-mono text-xs uppercase tracking-[0.15em] text-mbta-green-bright hover:underline"
              >
                Leaderboard →
              </Link>
            </div>
            <div className="pointer-events-auto self-start">
              <LineLegend chips />
            </div>
          </div>
        </div>
        <div className="p-3 lg:pointer-events-none lg:absolute lg:right-5 lg:top-5 lg:w-80 lg:p-0">
          <div className="lg:pointer-events-auto">
            <LeadersCard />
          </div>
        </div>
      </div>
      <HowItWorks />
      <footer className="pb-6 text-center font-mono text-xs text-hud-dim">
        Built for BostonHacks 2026 · Constant Buffers
      </footer>
    </main>
  );
}
