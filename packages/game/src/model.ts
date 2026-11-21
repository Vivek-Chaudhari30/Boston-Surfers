import { GAME, MAX_SCORE_PER_SEC } from '@cb/shared';
import type { RunResult } from './types';

export type Action = 'left' | 'right' | 'jump' | 'duck';
export type Hazard = 'barrier' | 'bar' | 'train';
export interface CourseRow {
  distance: number;
  lane: number;
  hazard: Hazard;
  coinLane: number;
  passed: boolean;
  collected: boolean;
}

/** All randomness belongs to the course, never to rendering or frame timing. */
export function makeCourse(seed: number, count = 800): CourseRow[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => {
    const lane = Math.floor(random() * GAME.LANES);
    return {
      distance: 70 + index * 25,
      lane,
      hazard: (['barrier', 'bar', 'train'] as const)[Math.floor(random() * 3)]!,
      coinLane: (lane + 1 + Math.floor(random() * 2)) % GAME.LANES,
      passed: false,
      collected: false,
    };
  });
}

export class RunnerModel {
  readonly rows: CourseRow[];
  lane = 1;
  distance = 0;
  durationMs = 0;
  coins = 0;
  score = 0;
  jumpLeft = 0;
  duckLeft = 0;
  running = false;
  ended = false;
  reason = '';
  private nextRow = 0;

  constructor(readonly seed: number) { this.rows = makeCourse(seed); }

  get speed(): number {
    return Math.min(GAME.MAX_SPEED, GAME.START_SPEED + this.durationMs / 3000);
  }

  start(): void { if (!this.ended) this.running = true; }

  act(action: Action): void {
    if (!this.running) return;
    if (action === 'left') this.lane = Math.max(0, this.lane - 1);
    if (action === 'right') this.lane = Math.min(GAME.LANES - 1, this.lane + 1);
    if (action === 'jump' && this.jumpLeft === 0 && this.duckLeft === 0) this.jumpLeft = 900;
    if (action === 'duck' && this.jumpLeft === 0 && this.duckLeft === 0) this.duckLeft = 850;
  }

  tick(delta: number): void {
    if (!this.running) return;
    // Ignore catch-up time after suspension; never teleport through a course.
    const dt = Math.max(0, Math.min(50, Number.isFinite(delta) ? delta : 0));
    const before = this.distance;
    const step = this.speed * dt / 1000;
    const nextDistance = before + step;
    const row = this.rows[this.nextRow];
    let consumed = dt;
    let collision = false;
    if (row && !row.passed && row.distance <= nextDistance) {
      consumed = step === 0 ? 0 : dt * Math.max(0, (row.distance - before) / step);
      const jumping = this.jumpLeft > consumed && this.jumpLeft - consumed < 830;
      const ducking = this.duckLeft > consumed;
      collision = this.lane === row.lane && (
        row.hazard === 'train' || (row.hazard === 'barrier' && !jumping) ||
        (row.hazard === 'bar' && !ducking)
      );
      row.passed = true;
      this.nextRow += 1;
      if (collision) this.reason = row.hazard === 'train' ? 'Switch lanes to avoid trains.' :
        row.hazard === 'barrier' ? 'Jump over the orange barriers.' : 'Duck under the overhead bars.';
      else consumed = dt;
    }
    this.durationMs += consumed;
    this.distance += this.speedAt(this.durationMs - consumed) * consumed / 1000;
    this.jumpLeft = Math.max(0, this.jumpLeft - consumed);
    this.duckLeft = Math.max(0, this.duckLeft - consumed);
    // Coins sit six metres before each obstacle, at most 1.2 coins/sec at max speed.
    for (let i = Math.max(0, this.nextRow - 1); i < Math.min(this.nextRow + 2, this.rows.length); i++) {
      const candidate = this.rows[i]!;
      const coinAt = candidate.distance - 6;
      if (!candidate.collected && coinAt > before && coinAt <= this.distance) {
        candidate.collected = true;
        if (this.lane === candidate.coinLane) this.coins += 1;
      }
    }
    this.score = Math.floor(this.distance * GAME.SCORE_PER_METER) + this.coins * GAME.COIN_VALUE;
    // Sanity limit derived from the shared validation contract.
    if (this.score > this.durationMs / 1000 * MAX_SCORE_PER_SEC) throw new Error('Score rate exceeded');
    if (collision || this.durationMs >= 540_000) {
      this.ended = true;
      this.running = false;
      if (!collision) this.reason = 'Route complete. Great run!';
    }
  }

  private speedAt(ms: number): number { return Math.min(GAME.MAX_SPEED, GAME.START_SPEED + ms / 3000); }

  result(): RunResult {
    return { score: this.score, coins: this.coins, durationMs: Math.round(this.durationMs),
      distance: Math.round(this.distance * 100) / 100 };
  }
}
