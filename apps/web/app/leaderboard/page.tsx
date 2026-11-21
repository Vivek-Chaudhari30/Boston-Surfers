import Link from 'next/link';
import { Suspense } from 'react';
import { DailyBoard } from '@/components/map/DailyBoard';
import { LineLegend } from '@/components/map/LineLegend';
import { TopBar } from '@/components/site/TopBar';
import { Panel } from '@/components/ui/Panel';
import { parseDay, shiftDay } from '@/lib/day';
import { bostonDate } from '@/lib/time';

type Search = Promise<{ date?: string | string[] }>;

/** All-MBTA daily leaderboard (Boston time). `?date=YYYY-MM-DD` browses past days. */
export default function LeaderboardPage({ searchParams }: { searchParams: Search }) {
  // cacheComponents: searchParams is request data, so it must render inside a Suspense boundary.
  return (
    <Suspense fallback={<main className="flex flex-1 flex-col" />}>
      <Leaderboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Leaderboard({ searchParams }: { searchParams: Search }) {
  const { date: raw } = await searchParams;
  const today = bostonDate();
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const day = parseDay(asked, today);
  const isToday = day === today;
  const href = (d: string) => (d === today ? '/leaderboard' : `/leaderboard?date=${d}`);
  const nav = 'hud-glass rounded-lg px-3 py-1.5 font-mono text-sm';

  return (
    <main className="flex flex-1 flex-col">
      <TopBar current="leaderboard" />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <Link href="/" className="font-mono text-sm text-hud-dim hover:text-hud-text">
          ← Live map
        </Link>
        <h1 className="hud-glow my-4 text-3xl font-semibold tracking-tight">Daily leaderboard</h1>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={href(shiftDay(day, -1))} className={nav} aria-label="Previous day">
            ←
          </Link>
          <span className="font-mono text-sm">{isToday ? `Today · ${day}` : day}</span>
          {isToday ? (
            <span className={`${nav} opacity-30`} aria-hidden>
              →
            </span>
          ) : (
            <Link href={href(shiftDay(day, 1))} className={nav} aria-label="Next day">
              →
            </Link>
          )}
        </div>
        <Panel title="Best run per rider · Boston time">
          <DailyBoard limit={20} date={isToday ? undefined : day} />
          <div className="mt-4 border-t border-hud-border pt-3">
            <LineLegend />
          </div>
        </Panel>
      </div>
    </main>
  );
}
