import { ReplayFile, stations, type TrainSnapshot } from '@cb/shared';
import { placeSnapshot, stationOrderFrom } from '@/lib/mbta/placement';
import type { TrainFeed } from './types';

export const DEFAULT_REPLAY_FILE = 'demo.json';

/**
 * Loads one recorded file from /replay/<file> (written by scripts/record-mbta.ts) and loops
 * its frames at the recorded interval. Each emitted frame gets a fresh fetchedAt and
 * source: 'replay', and is re-placed against the current stations.json (recordings may
 * predate it).
 */
export class ReplayTrainFeed implements TrainFeed {
  readonly kind = 'replay' as const;

  constructor(
    private readonly opts: { file?: string; intervalMs?: number; onError?: (err: unknown) => void } = {},
  ) {}

  subscribe(cb: (snap: TrainSnapshot) => void): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const file = this.opts.file ?? DEFAULT_REPLAY_FILE;

    (async () => {
      try {
        const res = await fetch(`/replay/${encodeURIComponent(file)}`);
        if (!res.ok) throw new Error(`replay ${file}: HTTP ${res.status}`);
        const replay = ReplayFile.parse(await res.json());
        if (stopped || replay.frames.length === 0) return;
        const order = stationOrderFrom(stations);
        let i = 0;
        const emit = () => {
          const frame = replay.frames[i % replay.frames.length]!;
          i++;
          cb(placeSnapshot({ ...frame, source: 'replay', fetchedAt: new Date().toISOString() }, order));
        };
        emit();
        timer = setInterval(emit, this.opts.intervalMs ?? replay.intervalMs);
      } catch (err) {
        if (!stopped) this.opts.onError?.(err);
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }
}
