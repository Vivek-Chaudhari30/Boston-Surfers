// Server only.
import type { TrainSnapshot } from '@cb/shared';

/** Upstream cache TTL: one MBTA call serves every kiosk (ARCHITECTURE §1). */
export const SNAPSHOT_CACHE_MS = 5_000;

/**
 * Current TrainSnapshot for GET /api/trains.
 * TODO: fetchVehicles() with MBTA_API_KEY → snapshotFromMbta(res, stationOrderFrom(stations)),
 * cached in memory for SNAPSHOT_CACHE_MS; dedupe concurrent requests.
 */
export async function getSnapshot(): Promise<TrainSnapshot> {
  throw new Error('getSnapshot: not implemented');
}
