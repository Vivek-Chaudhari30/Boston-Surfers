"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RunResult } from "@cb/game";
import { MeResponse, StartRunResponse, FinishRunResponse } from "@cb/shared";
import { api } from "@/lib/api-client";
import { savePersonalPractice } from "./practice-history";
const GameCanvas = dynamic(() => import("@/components/play/GameCanvas"), {
  ssr: false,
});
const noop = () => {};

export function MobileGame() {
  const [run, setRun] = useState<{ seed: number; runId?: string } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const submitted = useRef(false);
  const starting = useRef(false);
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setLoading(true);
    setError(false);
    let me: MeResponse | null = null;
    try {
      me = await api("/api/me", MeResponse);
    } catch {
      /* Practice does not require the cloud. */
    }
    if (me?.activeRide) {
      try {
        const next = await api("/api/runs", StartRunResponse, {
          body: { rideId: me.activeRide.id },
        });
        setRun(next);
        setNote("RANKED · YOUR ACTIVE CAR");
      } catch {
        setError(true);
        setNote("Could not start your ranked run. Please try again.");
        setLoading(false);
        starting.current = false;
        return;
      }
    } else {
      setRun({ seed: Math.floor(Math.random() * 2 ** 31) });
      setNote("PRACTICE · SAVED ON THIS PHONE");
    }
    setResult(null);
    submitted.current = false;
    setLoading(false);
    starting.current = false;
  }
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    void start();
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);
  async function finish(value: RunResult) {
    if (submitted.current || !run) return;
    submitted.current = true;
    setResult(value);
    if (!run.runId) {
      savePersonalPractice(value);
      setNote("Practice saved to your phone’s History.");
      return;
    }
    setPending(true);
    try {
      const response = await api(
        `/api/runs/${run.runId}/finish`,
        FinishRunResponse,
        {
          body: {
            score: Math.round(value.score),
            coins: Math.round(value.coins),
            durationMs: Math.round(value.durationMs),
          },
        },
      );
      setNote(
        response.accepted
          ? "Your run is saved to your personal history and the kiosk’s standings."
          : `Run not accepted: ${response.reason ?? "validation failed"}.`,
      );
    } catch {
      setNote(
        "Your score is visible. We could not confirm that it was saved to your account.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="mobile-game-screen">
      <header>
        <Link href="/mobile">← MY PASS</Link>
        <span>{note}</span>
      </header>
      <div className="mobile-game-stage">
        {run && !loading && !error && (
          <GameCanvas
            seed={run.seed}
            lineColor="#72f4dc"
            onScore={noop}
            onGameOver={finish}
          />
        )}
      </div>
      {(loading || error) && (
        <div className="mobile-game-message">
          <p>{loading ? "Preparing your next run…" : note}</p>
          {error && (
            <button className="personal-button" onClick={() => void start()}>
              TRY AGAIN
            </button>
          )}
        </div>
      )}
      {result && (
        <div className="comic-results-backdrop">
          <section
            className="comic-results mobile-personal-result"
            role="dialog"
            aria-modal="true"
            aria-label="Your run results"
          >
            <div className="comic-results-score">
              <p className="comic-type">THAT’S YOUR RUN!</p>
              <strong className="comic-type">
                {Math.round(result.score).toLocaleString()}
              </strong>
              <p>YOUR SCORE</p>
            </div>
            <div className="comic-results-body">
              <div className="personal-stats">
                <div>
                  <strong>{result.coins}</strong>
                  <span>Coins</span>
                </div>
                <div>
                  <strong>{Math.floor(result.distance)}</strong>
                  <span>Metres</span>
                </div>
              </div>
              <p role="status">{pending ? "Saving your run…" : note}</p>
              <button
                className="personal-button comic-type"
                disabled={pending || loading}
                onClick={() => void start()}
              >
                RUN IT BACK!
              </button>
              <Link href="/mobile/history" className="personal-secondary">
                MY RUN HISTORY ↗
              </Link>
              <Link href="/mobile/rewards" className="personal-secondary">
                MY WINNINGS ★
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
