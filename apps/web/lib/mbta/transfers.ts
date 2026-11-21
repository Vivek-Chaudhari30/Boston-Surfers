// Server only.
import type { TransfersResponse } from '@cb/shared';

/** Cache transfer answers per vehicle (ARCHITECTURE §2.5). */
export const TRANSFERS_CACHE_MS = 15_000;
/** Only suggest connections leaving at least this long after we arrive. */
export const MIN_TRANSFER_MIN = 2;

/**
 * Transfer help for GET /api/transfers?vehicleId=.
 * TODO (§2.5): predictions for the vehicle's trip → upcoming TRANSFER_STATIONS → predictions for
 * the other routes there → first departure ≥ MIN_TRANSFER_MIN after our ETA. Cache 15 s.
 */
export async function getTransfers(_vehicleId: string): Promise<TransfersResponse> {
  throw new Error('getTransfers: not implemented');
}
