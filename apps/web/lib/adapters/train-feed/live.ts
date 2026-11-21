import { TrainSnapshot } from '@cb/shared';
import type { TrainFeed } from './types';

export const LIVE_POLL_MS = 10_000;

/**
 * Polls /api/trains every 10 s. Calls onError after each failed fetch with the running
 * failure count, so the kiosk can switch to replay after 3 (ARCHITECTURE §8).
 */
export class LiveTrainFeed implements TrainFeed {
  readonly kind = 'live' as const;

  constructor(
    private readonly opts: { url?: string; intervalMs?: number; onError?: (failures: number, err: unknown) => void } = {},
  ) {}

  subscribe(cb: (snap: TrainSnapshot) => void): () => void {
    let stopped = false;
    let failures = 0;
    let controller: AbortController | null = null;
    const url = this.opts.url ?? '/api/trains';

    const tick = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snap = TrainSnapshot.parse(await res.json());
        failures = 0;
        if (!stopped) cb(snap);
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === 'AbortError')) return;
        failures++;
        this.opts.onError?.(failures, err);
      }
    };

    void tick();
    const timer = setInterval(tick, this.opts.intervalMs ?? LIVE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller?.abort();
    };
  }
}
