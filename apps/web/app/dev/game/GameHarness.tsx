"use client";

import { createRunner, type RunResult } from "@cb/game";
import { LINE_COLORS, maxScoreForDuration, type Line } from "@cb/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GeoMap } from "@/components/map/GeoMap";
import { useTrains } from "@/components/map/useTrains";
import { ArcadeBrand } from "@/components/play/ArcadeBrand";
import { ComicBoard, RunResults } from "@/components/play/RunResults";
import {
  PRACTICE_KEY,
  readPractice,
  recordPractice,
  type PracticeRun,
} from "./practice";

const LINES = Object.keys(LINE_COLORS) as Line[];
function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export default function GameHarness() {
  const hostRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<ReturnType<typeof createRunner> | null>(null);
  const historyRef = useRef<PracticeRun[]>([]);
  const [line, setLine] = useState<Line>("Green");
  const [seed, setSeed] = useState(newSeed);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<PracticeRun | null>(null);
  const [history, setHistory] = useState<PracticeRun[]>([]);
  const { snapshot, mode } = useTrains();
  useEffect(() => {
    try {
      const stored = readPractice(localStorage.getItem(PRACTICE_KEY));
      historyRef.current = stored;
      setHistory(stored);
    } catch {
      /* Storage may be disabled; session play still works. */
    }
  }, []);
  const finished = useCallback((run: RunResult) => {
    const saved = { ...run, id: crypto.randomUUID(), at: Date.now() };
    const next = recordPractice(historyRef.current, saved);
    historyRef.current = next;
    setHistory(next);
    setResult(saved);
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(next));
    } catch {
      /* Keep the in-memory standings. */
    }
  }, []);
  useEffect(() => {
    if (!hostRef.current) return;
    const runner = createRunner(hostRef.current, {
      seed,
      theme: { lineColor: LINE_COLORS[line] },
      onScoreChange: setScore,
      onGameOver: finished,
    });
    runnerRef.current = runner;
    return () => {
      runner.destroy();
      runnerRef.current = null;
    };
    // Seed changes go through restart; line changes remount the artwork.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, finished]);
  function restart() {
    const s = newSeed();
    setSeed(s);
    setScore(0);
    setResult(null);
    runnerRef.current?.restart(s);
  }
  const entries = history.map((r, i) => ({
    rank: i + 1,
    displayName: `You · ${new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    score: r.score,
  }));
  const rank = result ? history.findIndex((r) => r.id === result.id) + 1 : null;
  return (
    <div className="arcade-shell">
      <header className="arcade-nav">
        <ArcadeBrand />
        <nav className="arcade-links">
          <Link href="/dev/game" className="active">
            PLAY
          </Link>
          <Link href="/">CITY TRACKER</Link>
          <Link href="/leaderboard">LEADERS</Link>
        </nav>
      </header>
      <div className="arcade-grid">
        <aside className="arcade-side">
          <span className="arcade-kicker">BOSTONHACKS ’26 / ISSUE 001</span>
          <h1 className="arcade-title">
            The city.
            <br />
            The tracks.
            <br />
            <span>Your story.</span>
          </h1>
          <p className="arcade-description">
            Your ordinary commute just got a little <strong>super.</strong>{" "}
            Dodge the T, chase the gold, and write your own origin story.
          </p>
          <span className="arcade-sticker">WITH GREAT TRANSIT…</span>
          <div className="arcade-controls">
            <kbd>← →</kbd>
            <span>Switch tracks. Stay one move ahead.</span>
            <kbd>↑</kbd>
            <span>Jump the yellow barriers.</span>
            <kbd>↓</kbd>
            <span>Slide under the pink bars.</span>
          </div>
          <p className="arcade-practice-note" style={{ marginTop: 24 }}>
            No signup. No downloads.
            <br />
            Just your friendly neighborhood runner.
          </p>
        </aside>
        <div
          ref={hostRef}
          className="arcade-stage"
          aria-label="Boston Surfers game"
        />
        <aside className="arcade-side right">
          <section className="arcade-panel">
            <div className="arcade-panel-head">
              CITY SIGNAL <small>{mode.toUpperCase()}</small>
            </div>
            <div className="arcade-inset-map">
              <GeoMap snapshot={snapshot} interactive />
            </div>
            <div className="arcade-panel-body">
              <p>
                Real Boston tracks. Real train positions. Your next adventure is
                on the map.
              </p>
              <Link
                href="/"
                style={{ color: "#72f4dc", fontSize: 14, fontWeight: 800 }}
              >
                EXPLORE THE TRACKER
              </Link>
            </div>
          </section>
          <section className="arcade-panel">
            <div className="arcade-panel-head">
              PICK YOUR LINE <small>SUIT UP</small>
            </div>
            <div className="arcade-panel-body">
              <div className="arcade-line-picker">
                {LINES.map((l) => (
                  <button
                    key={l}
                    aria-label={`${l} Line`}
                    aria-pressed={line === l}
                    style={{ background: LINE_COLORS[l] }}
                    onClick={() => {
                      setResult(null);
                      setLine(l);
                    }}
                  >
                    {l[0]}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="arcade-panel">
            <div className="arcade-panel-head">
              LOCAL LEGENDS <small>PRACTICE</small>
            </div>
            <div className="arcade-panel-body">
              <ComicBoard entries={entries.slice(0, 3)} />
              <p style={{ marginTop: 12 }}>
                Your best runs on this device. Scan a car’s kiosk QR to join the
                real leaderboard.
              </p>
            </div>
          </section>
        </aside>
      </div>
      <details className="arcade-devdetails">
        <summary>Developer diagnostics</summary>
        <pre>
          {JSON.stringify(
            {
              seed,
              score,
              result,
              serverCeiling: result
                ? Math.floor(maxScoreForDuration(result.durationMs))
                : null,
            },
            null,
            2,
          )}
        </pre>
        <button onClick={restart}>Restart with a new seed</button>
      </details>
      {result && (
        <RunResults
          run={result}
          entries={entries}
          highlightRank={rank || null}
          source="practice"
          onReplay={restart}
          onLeave={() => {
            window.location.href = "/";
          }}
        />
      )}
    </div>
  );
}
