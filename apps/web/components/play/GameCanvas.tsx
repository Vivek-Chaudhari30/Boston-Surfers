'use client';

import { createRunner, type RunResult } from '@cb/game';
import { useEffect, useRef } from 'react';

/** Mounts the Phaser runner. Load via next/dynamic with ssr: false. A new `seed` restarts the run. */
export default function GameCanvas({
  seed,
  lineColor,
  onScore,
  onGameOver,
}: {
  seed: number;
  lineColor: string;
  onScore: (s: number) => void;
  onGameOver: (r: RunResult) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runner = useRef<ReturnType<typeof createRunner> | null>(null);
  const cbs = useRef({ onScore, onGameOver });
  useEffect(() => {
    cbs.current = { onScore, onGameOver };
  });

  useEffect(() => {
    if (!host.current) return;
    const r = createRunner(host.current, {
      seed,
      theme: { lineColor },
      onScoreChange: (s) => cbs.current.onScore(s),
      onGameOver: (res) => cbs.current.onGameOver(res),
    });
    runner.current = r;
    return () => {
      r.destroy();
      runner.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; seeds go through restart()
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    runner.current?.restart(seed);
  }, [seed]);

  return <div ref={host} className="h-full w-full" style={{ touchAction: 'none' }} />;
}
