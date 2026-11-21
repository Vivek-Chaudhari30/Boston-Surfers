import * as Phaser from 'phaser';
import { TRACK, VIEW } from '../config';
import { RunnerModel, type Action, type CourseRow } from '../model';
import type { RunnerOptions } from '../types';

export const RUNNER_SCENE_KEY = 'runner';
const INK = 0x071019;
const WHITE = 0xe8f0f2;
const MUTED = '#8eabb7';

export class RunnerScene extends Phaser.Scene {
  private model!: RunnerModel;
  private art!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private visualLane = 1;
  private reported = false;
  private lastScore = -1;
  private accent = 0x24d68b;
  private pointerStart: { x: number; y: number; at: number } | null = null;

  constructor(private readonly opts: RunnerOptions, private readonly playing: (active: boolean) => void) {
    super(RUNNER_SCENE_KEY);
  }

  init(data: { seed?: number } = {}): void {
    this.model = new RunnerModel(data.seed ?? this.opts.seed);
    this.visualLane = 1;
    this.reported = false;
    this.lastScore = -1;
    this.pointerStart = null;
    this.playing(false);
  }

  create(): void {
    const supplied = this.opts.theme?.lineColor;
    this.accent = supplied && /^#[0-9a-f]{6}$/i.test(supplied) ?
      Phaser.Display.Color.HexStringToColor(supplied).color : 0x24d68b;
    this.art = this.add.graphics();
    this.text(24, 23, 'BOSTON SURFERS', 13, '#a6c3ce').setLetterSpacing(2);
    this.hud = this.text(23, 44, '00000', 38, '#ffffff').setFontStyle('bold');
    this.coinsText = this.text(366, 31, '0 COINS', 15, '#ffd36e').setOrigin(1, 0);
    this.speedText = this.text(366, 57, '12 M/S', 12, MUTED).setOrigin(1, 0);
    this.text(195, 116, 'NEXT STOP  /  PARK STREET', 12, MUTED).setOrigin(0.5).setLetterSpacing(1);
    this.text(195, 744, 'SWIPE TO MOVE · UP TO JUMP · DOWN TO DUCK', 10, MUTED).setOrigin(0.5);
    const controls: [string, Action][] = [['LEFT', 'left'], ['JUMP', 'jump'], ['DUCK', 'duck'], ['RIGHT', 'right']];
    controls.forEach(([label, action], index) => {
      const x = 52 + index * 95;
      const button = this.add.rectangle(x, 791, 84, 47, 0x152631).setStrokeStyle(1, 0x36515c)
        .setInteractive({ useHandCursor: true });
      this.text(x, 791, label, 12, '#d9e7eb').setOrigin(0.5);
      button.on('pointerdown', () => { this.game.canvas.focus(); this.model.act(action); });
    });
    this.overlay = this.add.container(0, 0).setDepth(10);
    this.showIntro();

    const keyboard = (event: KeyboardEvent) => {
      if (document.activeElement !== this.game.canvas) return;
      const keys: Record<string, Action> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right',
        KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'duck', KeyS: 'duck' };
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        if (this.model.ended) { this.scene.restart({ seed: this.model.seed }); return; }
        if (!this.model.running) { this.startRun(); return; }
      }
      const action = keys[event.code];
      if (action && this.model.running) { event.preventDefault(); if (!event.repeat) this.model.act(action); }
    };
    const down = (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus();
      this.pointerStart = { x: pointer.x, y: pointer.y, at: this.time.now };
    };
    const up = (pointer: Phaser.Input.Pointer) => {
      const start = this.pointerStart;
      this.pointerStart = null;
      if (!start || !this.model.running || this.time.now - start.at > 900) return;
      const dx = pointer.x - start.x, dy = pointer.y - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      this.model.act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'jump' : 'duck'));
    };
    this.input.keyboard?.on('keydown', keyboard);
    this.input.on('pointerdown', down);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', keyboard);
      this.input.off('pointerdown', down);
      this.input.off('pointerup', up);
      this.input.off('pointerupoutside', up);
      this.playing(false);
    });
    this.opts.onScoreChange?.(0);
    this.paint(0);
  }

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${size}px`, color });
  }

  private startRun(): void {
    this.overlay.removeAll(true);
    this.model.start();
    this.playing(true);
    this.game.canvas.focus();
  }

  private showIntro(): void {
    const backdrop = this.add.rectangle(195, 423, 348, 344, INK, 0.97).setStrokeStyle(1, 0x41606b);
    const chip = this.text(195, 294, 'YOUR NEXT STOP: A NEW HIGH SCORE', 10, '#8eabb7').setOrigin(0.5);
    const title = this.text(195, 333, 'RIDE. RUN.\nREPEAT.', 42, '#ffffff').setOrigin(0.5, 0).setFontStyle('bold').setLineSpacing(-6);
    const detail = this.text(195, 455, 'Three tracks. One city.\nCollect coins. Keep moving.', 16, '#b8cdd5').setOrigin(0.5).setAlign('center');
    const button = this.add.rectangle(195, 531, 278, 51, this.accent).setInteractive({ useHandCursor: true });
    const label = this.text(195, 531, 'START RUN', 16, '#ffffff').setOrigin(0.5).setFontStyle('bold');
    button.on('pointerdown', () => this.startRun());
    this.overlay.add([backdrop, chip, title, detail, button, label]);
  }

  private showGameOver(): void {
    this.playing(false);
    const background = this.add.rectangle(195, 423, 348, 350, INK, 0.98).setStrokeStyle(1, 0x41606b);
    const title = this.text(195, 288, 'END OF THE LINE', 14, '#b8cdd5').setOrigin(0.5).setLetterSpacing(2);
    const score = this.text(195, 350, String(this.model.score), 66, '#ffffff').setOrigin(0.5).setFontStyle('bold');
    const stats = this.text(195, 414, `${Math.floor(this.model.distance)} METRES  ·  ${this.model.coins} COINS`, 13, '#ffd36e').setOrigin(0.5);
    const reason = this.text(195, 463, this.model.reason, 14, '#b8cdd5').setOrigin(0.5);
    const button = this.add.rectangle(195, 533, 278, 51, this.accent).setInteractive({ useHandCursor: true });
    const label = this.text(195, 533, 'TRY AGAIN', 16, '#ffffff').setOrigin(0.5).setFontStyle('bold');
    button.on('pointerdown', () => this.scene.restart({ seed: this.model.seed }));
    this.overlay.add([background, title, score, stats, reason, button, label]);
  }

  update(_time: number, delta: number): void {
    this.model.tick(delta);
    this.visualLane += (this.model.lane - this.visualLane) * Math.min(1, delta / 85);
    if (this.model.score !== this.lastScore) {
      this.lastScore = this.model.score;
      this.hud.setText(String(this.model.score).padStart(5, '0'));
      this.coinsText.setText(`${this.model.coins} COINS`);
      this.opts.onScoreChange?.(this.model.score);
    }
    this.speedText.setText(`${Math.floor(this.model.speed)} M/S`);
    this.paint(this.model.durationMs);
    if (this.model.ended && !this.reported) {
      this.reported = true;
      this.showGameOver();
      this.opts.onGameOver(this.model.result());
    }
  }

  private point(lane: number, ahead: number): { x: number; y: number; scale: number } {
    const depth = Math.max(0, Math.min(1, 1 - ahead / TRACK.LOOKAHEAD));
    const scale = 0.08 + depth * depth * 0.92;
    return { x: 195 + (lane - 1) * 126 * scale,
      y: TRACK.HORIZON + (TRACK.FEET - TRACK.HORIZON) * depth * depth, scale };
  }

  private polygon(points: number[], color: number, alpha = 1): void {
    const g = this.art;
    g.fillStyle(color, alpha).beginPath().moveTo(points[0]!, points[1]!);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i]!, points[i + 1]!);
    g.closePath().fillPath();
  }

  private paint(time: number): void {
    const g = this.art;
    g.clear().fillStyle(0x080f17).fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);
    g.fillStyle(0x101e28).fillRect(0, 150, 390, 575);
    this.polygon([0, 150, 166, 239, 166, 260, 0, 715], 0x162731);
    this.polygon([390, 150, 224, 239, 224, 260, 390, 715], 0x162731);
    this.polygon([166, 245, 224, 245, 510, 725, -120, 725], 0x0a141d);
    g.lineStyle(3, this.accent, 0.8).lineBetween(0, 365, 166, 247).lineBetween(390, 365, 224, 247);
    g.lineStyle(2, 0x35505c, 0.7);
    for (let rib = 0; rib < 7; rib++) {
      const p = this.point(1, ((rib * 15 + 100 - this.model.distance % 15) % 105));
      const width = 220 * p.scale;
      g.strokeRect(195 - width, p.y - 210 * p.scale, width * 2, 240 * p.scale);
    }
    // Four rail pairs and moving sleepers produce depth without sprites/assets.
    for (let lane = 0; lane < 3; lane++) {
      const far = this.point(lane, TRACK.LOOKAHEAD), near = this.point(lane, -8);
      g.lineStyle(2, 0x6d818c, 0.8);
      g.lineBetween(far.x - 2, far.y, near.x - 30, 726).lineBetween(far.x + 2, far.y, near.x + 30, 726);
      for (let sleeper = 0; sleeper < 15; sleeper++) {
        const p = this.point(lane, (sleeper * 7 + 105 - this.model.distance % 7) % 105);
        g.lineStyle(2 * p.scale + 0.5, 0x334854).lineBetween(p.x - 36 * p.scale, p.y, p.x + 36 * p.scale, p.y);
      }
    }
    g.fillStyle(0x050b11).fillRect(164, 211, 62, 36);
    g.fillStyle(this.accent).fillRect(183, 222, 24, 4);
    // Draw distant objects first; only nearby rows need rendering.
    const rows = this.model.rows.filter(row => row.distance - this.model.distance > -2 && row.distance - this.model.distance < TRACK.LOOKAHEAD + 6);
    for (let i = rows.length - 1; i >= 0; i--) this.drawRow(rows[i]!);
    this.drawRunner(time);
    g.fillStyle(0x080f17).fillRect(0, 725, 390, 119);
    g.lineStyle(1, 0x29414c).lineBetween(20, 724, 370, 724);
    g.fillStyle(this.accent).fillRect(24, 93, Math.min(342, this.model.distance % 500 / 500 * 342), 3);
  }

  private drawRow(row: CourseRow): void {
    const ahead = row.distance - this.model.distance;
    const { x, y, scale: s } = this.point(row.lane, ahead);
    const g = this.art;
    if (!row.passed) {
      if (row.hazard === 'train') {
        g.fillStyle(0x142b34).fillRoundedRect(x - 42 * s, y - 128 * s, 84 * s, 128 * s, 9 * s);
        g.lineStyle(2 * s, this.accent).strokeRoundedRect(x - 42 * s, y - 128 * s, 84 * s, 128 * s, 9 * s);
        g.fillStyle(0x88b1bc).fillRect(x - 31 * s, y - 103 * s, 62 * s, 43 * s);
        g.fillStyle(this.accent).fillRect(x - 40 * s, y - 40 * s, 80 * s, 12 * s);
        g.fillStyle(0xffe7ad).fillCircle(x - 27 * s, y - 19 * s, 5 * s).fillCircle(x + 27 * s, y - 19 * s, 5 * s);
      } else if (row.hazard === 'barrier') {
        g.fillStyle(0xf19543).fillRoundedRect(x - 41 * s, y - 40 * s, 82 * s, 36 * s, 3 * s);
        g.lineStyle(5 * s, 0x382716);
        for (let stripe = -28; stripe <= 20; stripe += 16) g.lineBetween(x + stripe * s, y - 35 * s, x + (stripe + 13) * s, y - 10 * s);
      } else {
        g.fillStyle(0x8cb4c4).fillRect(x - 43 * s, y - 112 * s, 6 * s, 112 * s).fillRect(x + 37 * s, y - 112 * s, 6 * s, 112 * s);
        g.fillStyle(0xf3c55b).fillRect(x - 43 * s, y - 77 * s, 86 * s, 24 * s);
      }
    }
    if (!row.collected && ahead > 6) {
      const coin = this.point(row.coinLane, ahead - 6);
      g.fillStyle(0xffcd57).fillEllipse(coin.x, coin.y - 24 * coin.scale, 18 * coin.scale, 23 * coin.scale);
      g.lineStyle(2 * coin.scale, 0x8c571c).lineBetween(coin.x, coin.y - 31 * coin.scale, coin.x, coin.y - 17 * coin.scale);
    }
  }

  private drawRunner(time: number): void {
    const g = this.art, x = 195 + (this.visualLane - 1) * 126;
    const jump = this.model.jumpLeft > 0 ? Math.sin((1 - this.model.jumpLeft / 900) * Math.PI) * 115 : 0;
    const duck = this.model.duckLeft > 0;
    const stride = this.model.running ? Math.sin(time / 70) * 9 : 0;
    const y = TRACK.FEET - jump;
    g.fillStyle(0x000000, 0.45).fillEllipse(x, TRACK.FEET + 5, 55 - jump / 8, 14);
    const bodyHeight = duck ? 24 : 43;
    g.lineStyle(10, 0x93aab6).lineBetween(x - 8, y - 18, x - 12 - stride, y).lineBetween(x + 8, y - 18, x + 12 + stride, y);
    g.fillStyle(this.accent).fillRoundedRect(x - 19, y - 23 - bodyHeight, 38, bodyHeight, 9);
    g.fillStyle(0xe1eef0).fillRoundedRect(x - 10, y - 22 - bodyHeight, 20, bodyHeight - 6, 5);
    g.lineStyle(7, this.accent).lineBetween(x - 20, y - 17 - bodyHeight, x - 26, y - 28 + stride / 2)
      .lineBetween(x + 20, y - 17 - bodyHeight, x + 26, y - 28 - stride / 2);
    g.fillStyle(0xe5b792).fillCircle(x, y - bodyHeight - 36, 13);
    g.fillStyle(0x233745).fillRoundedRect(x - 14, y - bodyHeight - 49, 28, 11, 4);
  }
}
