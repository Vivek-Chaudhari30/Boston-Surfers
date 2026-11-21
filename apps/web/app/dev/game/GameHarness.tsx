'use client';

import { createRunner, type RunResult } from '@cb/game';
import { LINE_COLORS, MAX_SCORE_PER_SEC, maxScoreForDuration, type Line } from '@cb/shared';
import { useEffect, useRef, useState } from 'react';

const LINES = Object.keys(LINE_COLORS) as Line[];

function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export default function GameHarness() {
  const hostRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<ReturnType<typeof createRunner> | null>(null);
  const [line, setLine] = useState<Line>('Green');
  const [seed, setSeed] = useState(newSeed);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);

  // Remount the runner when the theme changes; restart() handles new seeds.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const runner = createRunner(host, {
      seed,
      theme: { lineColor: LINE_COLORS[line] },
      onScoreChange: setScore,
      onGameOver: setResult,
    });
    runnerRef.current = runner;
    return () => {
      runner.destroy();
      runnerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed changes go through restart()
  }, [line]);

  function restart() {
    const s = newSeed();
    setSeed(s);
    setResult(null);
    setScore(0);
    runnerRef.current?.restart(s);
  }

  const ceiling = result ? Math.floor(maxScoreForDuration(result.durationMs)) : null;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 md:flex-row">
      <div
        ref={hostRef}
        className="mx-auto aspect-[390/844] w-full max-w-[390px] overflow-hidden rounded-xl border border-hud-border"
        style={{ touchAction: 'none' }}
      />
      <aside className="flex flex-1 flex-col gap-3 font-mono text-sm">
        <div className="flex flex-wrap gap-2">
          {LINES.map((l) => (
            <button
              key={l}
              onClick={() => setLine(l)}
              className={`rounded px-3 py-1 ${l === line ? 'text-white' : 'text-hud-dim'}`}
              style={{ border: `1px solid ${LINE_COLORS[l]}`, background: l === line ? LINE_COLORS[l] : 'transparent' }}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={restart} className="rounded border border-hud-border bg-hud-panel px-3 py-2 text-left">
          restart(seed)
        </button>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-hud-dim">seed</dt>
          <dd>{seed}</dd>
          <dt className="text-hud-dim">live score</dt>
          <dd>{score}</dd>
          <dt className="text-hud-dim">MAX_SCORE_PER_SEC</dt>
          <dd>{MAX_SCORE_PER_SEC}</dd>
        </dl>
        <div className="rounded border border-hud-border bg-hud-panel p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-hud-dim">RunResult</div>
          {result ? (
            <>
              <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              <p className={result.score <= (ceiling ?? 0) ? 'text-mbta-green' : 'text-mbta-red'}>
                server ceiling for this duration: {ceiling} ({result.score <= (ceiling ?? 0) ? 'would pass' : 'would be rejected'})
              </p>
            </>
          ) : (
            <p className="text-hud-dim">Waiting for onGameOver…</p>
          )}
        </div>
      </aside>
    </div>
  );
}
