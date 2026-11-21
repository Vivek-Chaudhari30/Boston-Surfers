/** Rendering config for the runner. Jeet: tune freely; this is not a contract. */
export const VIEW = {
  WIDTH: 390,
  HEIGHT: 844,
  BACKGROUND: '#05070d',
} as const;

/** Stub-only settings. Delete with the stub. */
export const STUB = {
  RUN_MS: 10_000,
  POINTS_PER_TAP: 10,
} as const;
