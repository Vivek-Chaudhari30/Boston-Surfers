/**
 * Game rules shared by the Phaser runner (@cb/game) and server-side score validation.
 * CONTRACT (ARCHITECTURE §6): frozen after hour 1. Change only with both owners' agreement.
 */
export const GAME = {
  LANES: 3,
  START_SPEED: 12,
  MAX_SPEED: 30,
  SCORE_PER_METER: 1,
  COIN_VALUE: 10,
  MAX_COINS_PER_SEC: 4,
} as const;

/** Upper bound on points per second a legit run can earn. = 70 */
export const MAX_SCORE_PER_SEC =
  GAME.MAX_SPEED * GAME.SCORE_PER_METER + GAME.MAX_COINS_PER_SEC * GAME.COIN_VALUE;

/** Server-side anti-cheat thresholds (ARCHITECTURE §7). */
export const RUN_LIMITS = {
  /** Minimum plausible run length. */
  MIN_DURATION_MS: 3000,
  /** Allowed clock skew between client duration and server wall time. */
  DURATION_SKEW_MS: 2000,
  /** Multiplier of slack on MAX_SCORE_PER_SEC. */
  SCORE_SLACK_FACTOR: 1.1,
  /** Flat bonus slack on the score ceiling. */
  SCORE_SLACK_FLAT: 50,
  /** A run older than this can no longer be finished. */
  MAX_RUN_AGE_MS: 10 * 60 * 1000,
} as const;

/** Rides auto-expire after this long (ARCHITECTURE §0). */
export const RIDE_TTL_MS = 90 * 60 * 1000;

/** Highest score the server will accept for a run of the given duration. */
export function maxScoreForDuration(durationMs: number): number {
  return (
    (durationMs / 1000) * MAX_SCORE_PER_SEC * RUN_LIMITS.SCORE_SLACK_FACTOR +
    RUN_LIMITS.SCORE_SLACK_FLAT
  );
}
