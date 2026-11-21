import { readFlags, type AdapterFlags } from '../flags';
import { LiveTrainFeed } from './live';
import { ReplayTrainFeed } from './replay';
import type { TrainFeed } from './types';

export type { TrainFeed, TrainSnapshot } from './types';
export { LiveTrainFeed } from './live';
export { ReplayTrainFeed } from './replay';

/** Pick the feed from `?feed=live|replay` (default live). `?replay=<file>` picks the file. */
export function createTrainFeed(
  flags: Pick<AdapterFlags, 'feed'> = readFlags(),
  opts: { replayFile?: string; onError?: (err: unknown) => void } = {},
): TrainFeed {
  if (flags.feed === 'replay') return new ReplayTrainFeed({ file: opts.replayFile, onError: opts.onError });
  return new LiveTrainFeed({ onError: (_n, err) => opts.onError?.(err) });
}
