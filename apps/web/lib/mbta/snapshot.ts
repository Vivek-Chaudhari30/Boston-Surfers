// Server only.
import { stations, type TrainSnapshot } from '@cb/shared';
import { fetchVehicles } from './client';
import { snapshotFromMbta, stationOrderFrom } from './placement';

/** Upstream cache TTL: one MBTA call serves every kiosk (ARCHITECTURE §1). */
export const SNAPSHOT_CACHE_MS = 5_000;

const order = stationOrderFrom(stations);
let cached: { at: number; snap: TrainSnapshot } | null = null;
let inflight: Promise<TrainSnapshot> | null = null;

/** Current TrainSnapshot, cached 5 s, concurrent callers share one upstream request. */
export async function getSnapshot(): Promise<TrainSnapshot> {
  if (cached && Date.now() - cached.at < SNAPSHOT_CACHE_MS) return cached.snap;
  inflight ??= (async () => {
    try {
      const res = await fetchVehicles({ apiKey: process.env.MBTA_API_KEY || undefined, signal: AbortSignal.timeout(6000) });
      const snap = snapshotFromMbta(res, order);
      cached = { at: Date.now(), snap };
      return snap;
    } finally {
      inflight = null;
    }
  })();
  try {
    return await inflight;
  } catch (err) {
    // Serve slightly stale data rather than nothing (up to 60 s old).
    if (cached && Date.now() - cached.at < 60_000) return cached.snap;
    throw err;
  }
}
