import type { FinishRunResponse } from '@cb/shared';
import type { LiveRacer, RaceStanding } from '@/lib/race';
import { liveOrder } from '@/lib/race';
import { medal } from './raceLogic';

export const REJECT_TEXT: Record<string, string> = {
  too_short: 'Runs under 3 seconds don’t count.',
  score_too_high: 'That score didn’t pass our checks.',
  duration_mismatch: 'That run’s timing didn’t add up.',
  ride_inactive: 'Your ride ended. Scan the kiosk again to keep playing.',
  too_old: 'That run took too long to submit.',
};

export function BigText({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-3xl font-semibold">{children}</p>
      {sub && <p className="text-hud-dim">{sub}</p>}
    </div>
  );
}

export function Countdown({ secs, racers }: { secs: number; racers: number }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-hud-dim">Race starts in</p>
      <p className="font-mono text-8xl tabular-nums">{secs}</p>
      <p className="text-hud-dim">{racers > 0 ? `${racers} racer${racers === 1 ? '' : 's'}` : 'Get ready…'}</p>
    </div>
  );
}

/** Live positions: cosmetic hints from the racers' broadcasts. */
export function LiveStandings({ racers, meId, now }: { racers: ReadonlyMap<string, LiveRacer>; meId: string; now: number }) {
  const rows = liveOrder(racers.values());
  if (rows.length === 0) return <p className="text-center text-hud-dim">No scores yet.</p>;
  return (
    <ol className="flex w-full flex-col gap-1">
      {rows.map((r, i) => (
        <li
          key={r.riderId}
          className={`flex items-baseline gap-3 rounded-lg px-3 py-2 ${r.riderId === meId ? 'bg-mbta-green/20' : ''}`}
        >
          <span className="w-6 font-mono text-hud-dim">{i + 1}</span>
          <span className="flex-1 truncate">{r.name}</span>
          <span className="font-mono text-xs text-hud-dim">{!r.alive || now - r.seenAt > 20_000 ? 'out' : 'running'}</span>
          <span className="font-mono tabular-nums">{r.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

export function Podium({ standings, meId }: { standings: RaceStanding[]; meId: string }) {
  if (standings.length === 0) return <p className="text-center text-hud-dim">No finished runs this race.</p>;
  return (
    <ol className="flex w-full flex-col gap-1">
      {standings.map((s, i) => (
        <li
          key={s.riderId}
          className={`flex items-baseline gap-3 rounded-lg px-3 py-2 ${s.riderId === meId ? 'bg-mbta-green/20' : ''}`}
        >
          <span className="w-8 text-xl">{medal(i)}</span>
          <span className="flex-1 truncate">{s.displayName}</span>
          <span className="font-mono tabular-nums">{s.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

export function MyResult({ result, score }: { result: FinishRunResponse | null; score: number }) {
  if (!result) return <p className="text-center text-sm text-hud-dim">Submitting your run…</p>;
  return (
    <div className="text-center text-sm text-hud-dim">
      {result.accepted ? (
        <p>
          Your run: <span className="font-mono text-hud-text">{score.toLocaleString()}</span>
          {result.carRank && <> · Car rank <span className="font-mono text-hud-text">#{result.carRank}</span></>}
        </p>
      ) : (
        <p>Your run didn’t count. {result.reason ? (REJECT_TEXT[result.reason] ?? 'Try another run.') : ''}</p>
      )}
    </div>
  );
}
