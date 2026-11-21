import { LineBar, Panel, Placeholder } from '@/components/ui/Panel';

/** All-MBTA daily leaderboard. */
export default function LeaderboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <LineBar />
      <div className="mx-auto w-full max-w-3xl p-6">
        <h1 className="mb-6 text-3xl font-semibold">Daily leaderboard</h1>
        <Panel title="Today (Boston time)">
          <Placeholder>GET /api/leaderboard/daily: TODO</Placeholder>
        </Panel>
      </div>
    </main>
  );
}
