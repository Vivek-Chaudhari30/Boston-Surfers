/**
 * STUB scene: "Tap to score". Each tap = +10 points, the run ends after 10 s.
 * Jeet replaces this with the real runner (lanes, swipes, coins, obstacles).
 */
import * as Phaser from 'phaser';
import { STUB, VIEW } from '../config';
import type { RunnerOptions } from '../types';

export const STUB_SCENE_KEY = 'stub';

export type StubSceneData = { seed: number };

export class StubScene extends Phaser.Scene {
  private score = 0;
  private startedAt = 0;
  private over = false;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;

  constructor(private readonly opts: RunnerOptions) {
    super(STUB_SCENE_KEY);
  }

  init(_data: StubSceneData): void {
    this.score = 0;
    this.over = false;
    this.startedAt = 0;
  }

  create(): void {
    const color = this.opts.theme?.lineColor ?? '#00843D';
    const cx = VIEW.WIDTH / 2;
    this.add.rectangle(cx, VIEW.HEIGHT / 2, VIEW.WIDTH - 24, VIEW.HEIGHT - 24).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(color).color);
    this.add
      .text(cx, VIEW.HEIGHT * 0.3, 'Tap to score', { fontFamily: 'system-ui, sans-serif', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    this.scoreText = this.add
      .text(cx, VIEW.HEIGHT * 0.5, '0', { fontFamily: 'system-ui, sans-serif', fontSize: '96px', color })
      .setOrigin(0.5);
    this.timeText = this.add
      .text(cx, VIEW.HEIGHT * 0.7, '10.0 s', { fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#9aa4b2' })
      .setOrigin(0.5);

    // One clock for start and elapsed: scene.time.now and update()'s `time` can have different origins.
    this.startedAt = performance.now();
    this.input.on('pointerdown', () => {
      if (this.over) return;
      this.score += STUB.POINTS_PER_TAP;
      this.scoreText.setText(String(this.score));
      this.opts.onScoreChange?.(this.score);
    });
    this.opts.onScoreChange?.(0);
  }

  update(): void {
    if (this.over) return;
    const elapsed = performance.now() - this.startedAt;
    const left = Math.max(0, STUB.RUN_MS - elapsed);
    this.timeText.setText(`${(left / 1000).toFixed(1)} s`);
    if (left <= 0) {
      this.over = true;
      this.timeText.setText('Game over');
      this.opts.onGameOver({ score: this.score, coins: 0, durationMs: Math.round(elapsed), distance: 0 });
    }
  }
}
