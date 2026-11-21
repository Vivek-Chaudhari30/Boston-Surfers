import Link from 'next/link';
import { DailyBoard } from '@/components/map/DailyBoard';
import { LineBar, Panel } from '@/components/ui/Panel';

/** All-MBTA daily leaderboard (Boston time). */
export default function LeaderboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <LineBar />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <Link href="/" className="font-mono text-sm text-hud-dim">
          ← Live map
        </Link>
        <h1 className="my-4 text-3xl font-semibold">Daily leaderboard</h1>
        <Panel title="Today · best run per rider · Boston time">
          <DailyBoard limit={20} />
        </Panel>
      </div>
    </main>
  );
}
