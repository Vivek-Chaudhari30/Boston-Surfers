'use client';

import type { TrainSnapshot } from '@cb/shared';
import { useEffect, useState } from 'react';
import { LiveTrainFeed, ReplayTrainFeed, type TrainFeed } from '@/lib/adapters/train-feed';

export const LIVE_FAILURES_BEFORE_REPLAY = 3;

/**
 * Train snapshots through the TrainFeed adapter. Starts on `feed` (live by default) and drops to
 * replay after 3 failed live fetches (ARCHITECTURE §8).
 */
export function useTrains(opts: { feed?: 'live' | 'replay'; replayFile?: string } = {}) {
  const [snapshot, setSnapshot] = useState<TrainSnapshot | null>(null);
  const [mode, setMode] = useState<'live' | 'replay'>(opts.feed ?? 'live');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let feed: TrainFeed;
    if (mode === 'live') {
      feed = new LiveTrainFeed({
        onError: (failures) => {
          setError(`live feed failed ${failures}×`);
          if (failures >= LIVE_FAILURES_BEFORE_REPLAY) setMode('replay');
        },
      });
    } else {
      feed = new ReplayTrainFeed({ file: opts.replayFile, onError: (e) => setError(`replay: ${String(e)}`) });
    }
    return feed.subscribe((s) => {
      setSnapshot(s);
      setError(null);
    });
  }, [mode, opts.replayFile]);

  return { snapshot, mode, setMode, error };
}
