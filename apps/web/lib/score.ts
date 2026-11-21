/**
 * Server-side run validation (ARCHITECTURE §7). Pure, tested.
 */
import { GAME, RUN_LIMITS, maxScoreForDuration, type FinishRunRequest, type RunRejectReason } from '@cb/shared';

export type RunRow = {
  rider_id: string;
  status: 'started' | 'finished' | 'rejected';
  started_at: string;
};

export type RideRow = { rider_id: string; ended_at: string | null; started_at: string };

export function validateRun(args: {
  run: RunRow;
  ride: RideRow | null;
  riderId: string;
  input: FinishRunRequest;
  now: number;
  rideTtlMs: number;
}): RunRejectReason | null {
  const { run, ride, riderId, input, now, rideTtlMs } = args;
  if (run.rider_id !== riderId) return 'not_owner';
  if (run.status === 'finished' || run.status === 'rejected') return 'already_finished';
  if (run.status !== 'started') return 'not_started';
  if (!ride || ride.rider_id !== riderId || ride.ended_at !== null || now - Date.parse(ride.started_at) > rideTtlMs) {
    return 'ride_inactive';
  }
  const elapsed = now - Date.parse(run.started_at);
  if (elapsed > RUN_LIMITS.MAX_RUN_AGE_MS) return 'too_old';
  if (input.durationMs < RUN_LIMITS.MIN_DURATION_MS) return 'too_short';
  if (input.durationMs > elapsed + RUN_LIMITS.DURATION_SKEW_MS) return 'duration_mismatch';
  if (input.score > maxScoreForDuration(input.durationMs)) return 'score_too_high';
  if (input.coins * GAME.COIN_VALUE > input.score) return 'coins_mismatch';
  return null;
}
