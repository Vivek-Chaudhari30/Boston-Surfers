'use client';
import type { Entry } from '@cb/shared';

/** Per-tab conveniences. Server state is the source of truth; these only survive refreshes. */
export type LastRun = { rideId: string; bestThisRide: number; carRank: number | null; carLeaderboard: Entry[] };
export type StoredClaim = { code: string; expiresAt: string };

const LAST_RUN = 'cb:last-run';
const CLAIM = 'cb:claim';

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export const lastRunStore = { get: () => read<LastRun>(LAST_RUN), set: (v: LastRun | null) => write(LAST_RUN, v) };
export const claimStore = { get: () => read<StoredClaim>(CLAIM), set: (v: StoredClaim | null) => write(CLAIM, v) };
