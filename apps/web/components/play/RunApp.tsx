'use client';

import { FinishRunResponse, LINE_COLORS, MeResponse, StartRunResponse, type Ride } from '@cb/shared';
import type { RunResult } from '@cb/game';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/api-client';
import { Board } from './Board';
import { lastRunStore } from './storage';
import { ErrorNote, GhostButton, PrimaryButton } from './ui';

const GameCanvas = dynamic(() => import('./GameCanvas'), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-hud-dim">Loading game…</p>,
});

const REJECT_TEXT: Record<string, string> = {
  too_short: 'Runs under 3 seconds don’t count.',
  score_too_high: 'That score didn’t pass our checks.',
  duration_mismatch: 'That run’s timing didn’t add up.',
  ride_inactive: 'Your ride ended. Scan the kiosk again to keep playing.',
  too_old: 'That run took too long to submit.',
};

/** /play/run: full-screen game. POST /api/runs → play → POST finish → result overlay. */
export function RunApp() {
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [run, setRun] = useState<StartRunResponse | null>(null);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<FinishRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const starting = useRef(false);
  // The game can replay a course locally (its own Retry / Enter). Only the first result per server run counts.
  const submitted = useRef<string | null>(null);

  const start = useCallback(async (rideId: string) => {
    if (starting.current) return;
    starting.current = true;
    setError(null);
    try {
      const r = await api('/api/runs', StartRunResponse, { body: { rideId } });
      setResult(null);
      setScore(0);
      setRun(r);
    } catch (err) {
      setError(errorText(err));
    } finally {
      starting.current = false;
    }
  }, []);

  useEffect(() => {
    // Lock page scroll while playing (iOS Safari swipes).
    const html = document.documentElement;
    const prev = [html.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    (async () => {
      try {
        const me = await api('/api/me', MeResponse);
        if (!me.activeRide) return router.replace('/play');
        setRide(me.activeRide);
        await start(me.activeRide.id);
      } catch (err) {
        setError(errorText(err));
      }
    })();
    return () => {
      [html.style.overflow, html.style.overscrollBehavior] = prev;
    };
  }, [router, start]);

  const onGameOver = useCallback(
    async (res: RunResult) => {
      if (!run || !ride || submitted.current === run.runId) return;
      submitted.current = run.runId;
      try {
        const r = await api(`/api/runs/${run.runId}/finish`, FinishRunResponse, {
          body: { score: Math.round(res.score), coins: Math.round(res.coins), durationMs: Math.round(res.durationMs) },
        });
        lastRunStore.set({ rideId: ride.id, bestThisRide: r.bestThisRide, carRank: r.carRank, carLeaderboard: r.carLeaderboard });
        setResult(r);
      } catch (err) {
        setError(errorText(err));
      }
    },
    [run, ride],
  );

  const color = ride ? LINE_COLORS[ride.line] : LINE_COLORS.Green;

  return (
    <main className="fixed inset-0 flex flex-col bg-hud-bg" style={{ touchAction: 'none' }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] font-mono">
        <button onClick={() => router.push('/play')} className="text-hud-dim">
          ← Lobby
        </button>
        <span className="text-2xl tabular-nums" style={{ color }}>
          {score.toLocaleString()}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {run && <GameCanvas seed={run.seed} lineColor={color} onScore={setScore} onGameOver={onGameOver} />}
        {(result || error) && (
          <div className="absolute inset-0 flex items-end justify-center bg-hud-bg/80 p-4 backdrop-blur-sm sm:items-center">
            <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-hud-border bg-hud-panel p-5">
              {error && <ErrorNote>{error}</ErrorNote>}
              {result && (
                <>
                  <h2 className="text-2xl font-semibold">
                    {result.accepted ? `${score.toLocaleString()} points` : 'Run not counted'}
                  </h2>
                  {!result.accepted && result.reason && (
                    <p className="text-hud-dim">{REJECT_TEXT[result.reason] ?? 'Try another run.'}</p>
                  )}
                  <p className="text-hud-dim">
                    Best this ride: <span className="font-mono text-hud-text">{result.bestThisRide.toLocaleString()}</span>
                    {result.carRank && <> · Car rank <span className="font-mono text-hud-text">#{result.carRank}</span></>}
                  </p>
                  <Board entries={result.carLeaderboard} highlightRank={result.carRank} />
                </>
              )}
              {ride && (
                <PrimaryButton color={color} onClick={() => start(ride.id)}>
                  Play again
                </PrimaryButton>
              )}
              <GhostButton onClick={() => router.push('/play')}>Back to lobby</GhostButton>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
