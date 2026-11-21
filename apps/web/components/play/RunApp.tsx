"use client";

import {
  FinishRunResponse,
  LINE_COLORS,
  MeResponse,
  StartRunResponse,
  type Ride,
} from "@cb/shared";
import type { RunResult } from "@cb/game";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api-client";
import { RunResults } from "./RunResults";
import { lastRunStore } from "./storage";

const GameCanvas = dynamic(() => import("./GameCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-hud-dim">Loading game…</p>,
});

const noop = () => {};

const REJECT_TEXT: Record<string, string> = {
  too_short: "Runs under 3 seconds don’t count.",
  score_too_high: "That score didn’t pass our checks.",
  duration_mismatch: "That run’s timing didn’t add up.",
  ride_inactive: "Your ride ended. Scan the kiosk again to keep playing.",
  too_old: "That run took too long to submit.",
};

/** /play/run: full-screen game. POST /api/runs → play → POST finish → result overlay. */
export function RunApp() {
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [run, setRun] = useState<StartRunResponse | null>(null);
  const [submittedScore, setSubmittedScore] = useState(0);
  const [finishedRun, setFinishedRun] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      const r = await api("/api/runs", StartRunResponse, { body: { rideId } });
      setResult(null);
      setFinishedRun(null);
      setSubmittedScore(0);
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
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    (async () => {
      try {
        const me = await api("/api/me", MeResponse);
        if (!me.activeRide) return router.replace("/play");
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
      setSubmittedScore(Math.round(res.score));
      setFinishedRun(res);
      setSubmitting(true);
      try {
        const r = await api(
          `/api/runs/${run.runId}/finish`,
          FinishRunResponse,
          {
            body: {
              score: Math.round(res.score),
              coins: Math.round(res.coins),
              durationMs: Math.round(res.durationMs),
            },
          },
        );
        lastRunStore.set({
          rideId: ride.id,
          bestThisRide: r.bestThisRide,
          carRank: r.carRank,
          carLeaderboard: r.carLeaderboard,
        });
        setSubmittedScore(Math.round(res.score));
        setResult(r);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setSubmitting(false);
      }
    },
    [run, ride],
  );

  const color = ride ? LINE_COLORS[ride.line] : LINE_COLORS.Green;
  const cached = finishedRun ? lastRunStore.get() : null;
  const previousBoard =
    cached?.rideId === ride?.id ? (cached?.carLeaderboard ?? []) : [];

  return (
    <main
      className="fixed inset-0 flex flex-col bg-hud-bg"
      style={{ touchAction: "none" }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] font-mono">
        <button onClick={() => router.push("/play")} className="text-hud-dim">
          ← Lobby
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {run && (
          <GameCanvas
            seed={run.seed}
            lineColor={color}
            onScore={noop}
            onGameOver={onGameOver}
          />
        )}
        {finishedRun && (
          <RunResults
            run={{ ...finishedRun, score: submittedScore }}
            entries={result?.carLeaderboard ?? previousBoard}
            highlightRank={result?.carRank}
            pending={submitting}
            error={error}
            source="ranked"
            note={
              result
                ? result.accepted
                  ? `Best this ride: ${result.bestThisRide.toLocaleString()}${result.carRank ? ` · Car rank #${result.carRank}` : ""}`
                  : (REJECT_TEXT[result.reason ?? ""] ??
                    "This run was not accepted. Try another run.")
                : error
                  ? "Your score is visible, but submission could not be confirmed."
                  : undefined
            }
            onReplay={() => {
              if (ride) void start(ride.id);
            }}
            onLeave={() => router.push("/play")}
          />
        )}
        {error && !finishedRun && (
          <div className="comic-results-backdrop">
            <div className="comic-results">
              <div className="comic-results-body">
                <p className="comic-results-error">{error}</p>
                <button
                  className="comic-button"
                  onClick={() => {
                    if (ride) void start(ride.id);
                    else router.push("/play");
                  }}
                >
                  TRY AGAIN
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
