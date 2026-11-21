import type { TrainSnapshot } from '@cb/shared';

export type { TrainSnapshot };

export interface TrainFeed {
  readonly kind: 'live' | 'replay';
  subscribe(cb: (snap: TrainSnapshot) => void): () => void;
}
