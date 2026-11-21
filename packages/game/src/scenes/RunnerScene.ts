import * as Phaser from "phaser";
import { TRACK } from "../config";
import { RunnerModel, type Action } from "../model";
import type { RunnerOptions } from "../types";
import { drawHero, drawWorld, INK, polygon } from "./ComicWorld";

export const RUNNER_SCENE_KEY = "runner";
const COMIC = 'Impact, "Arial Black", sans-serif';
const BODY = '"Trebuchet MS", system-ui, sans-serif';
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
};

export class RunnerScene extends Phaser.Scene {
  private model!: RunnerModel;
  private world!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private visualLane = 1;
  private reported = false;
  private lastScore = -1;
  private lastCoins = 0;
  private accent = 0x24d9bf;
  private clock = 0;
  private reducedMotion = false;
  private sparks: Spark[] = [];
  private pointerStart: { x: number; y: number; at: number } | null = null;

  constructor(
    private readonly opts: RunnerOptions,
    private readonly playing: (active: boolean) => void,
  ) {
    super(RUNNER_SCENE_KEY);
  }

  init(data: { seed?: number } = {}): void {
    this.model = new RunnerModel(data.seed ?? this.opts.seed);
    this.visualLane = 1;
    this.reported = false;
    this.lastScore = -1;
    this.lastCoins = 0;
    this.pointerStart = null;
    this.clock = 0;
    this.sparks = [];
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.playing(false);
  }

  create(): void {
    const supplied = this.opts.theme?.lineColor;
    this.accent =
      supplied && /^#[0-9a-f]{6}$/i.test(supplied)
        ? Phaser.Display.Color.HexStringToColor(supplied).color
        : 0x24d9bf;
    this.world = this.add.graphics();
    this.hero = this.add.graphics().setDepth(2);
    this.effects = this.add.graphics().setDepth(3);
    const chrome = this.add.graphics().setDepth(4);
    chrome.fillStyle(INK).fillRect(0, 0, 390, 96);
    chrome.fillStyle(this.accent).fillRect(0, 0, 390, 5);
    chrome.fillStyle(0xffd74f).fillRoundedRect(15, 13, 180, 68, 12);
    chrome.lineStyle(3, 0xffffff).strokeRoundedRect(15, 13, 180, 68, 12);
    chrome.fillStyle(0xfff8df).fillRoundedRect(207, 13, 168, 38, 11);
    chrome.fillStyle(0x35e6d1).fillRoundedRect(207, 59, 168, 22, 7);
    this.label(29, 18, "YOUR SCORE", 12, "#242446").setDepth(5);
    this.hud = this.label(28, 31, "00000", 39, "#181e3a", true)
      .setStroke("#181e3a", 0)
      .setDepth(5);
    this.coinsText = this.label(290, 32, "★  0", 24, "#25213c", true)
      .setOrigin(0.5)
      .setDepth(5);
    this.speedText = this.label(291, 70, "12 M/S · LET’S ROLL", 11, "#17283d")
      .setOrigin(0.5)
      .setDepth(5);
    const sign = this.add.container(195, 146);
    const plate = this.add
      .rectangle(0, 0, 252, 33, 0xffffff)
      .setStrokeStyle(3, INK);
    sign.add([
      plate,
      this.label(
        0,
        0,
        "BOSTON  /  THE CITY IS YOURS",
        13,
        "#242347",
        true,
      ).setOrigin(0.5),
    ]);
    sign.setAngle(-2);
    this.makeControls(chrome);
    this.overlay = this.add.container(0, 0).setDepth(10);
    this.showIntro();

    const keyboard = (event: KeyboardEvent) => {
      if (document.activeElement !== this.game.canvas) return;
      const keys: Record<string, Action> = {
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
        ArrowUp: "jump",
        KeyW: "jump",
        Space: "jump",
        ArrowDown: "duck",
        KeyS: "duck",
      };
      if (
        (event.code === "Enter" || event.code === "Space") &&
        !this.model.running &&
        !this.model.ended
      ) {
        event.preventDefault();
        this.startRun();
        return;
      }
      const action = keys[event.code];
      if (action && this.model.running) {
        event.preventDefault();
        if (!event.repeat) this.act(action);
      }
    };
    const down = (p: Phaser.Input.Pointer) => {
      this.game.canvas.focus({ preventScroll: true });
      this.pointerStart = { x: p.x, y: p.y, at: this.time.now };
    };
    const up = (p: Phaser.Input.Pointer) => {
      const start = this.pointerStart;
      this.pointerStart = null;
      if (!start || !this.model.running || this.time.now - start.at > 900)
        return;
      const dx = p.x - start.x,
        dy = p.y - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      this.act(
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0
            ? "left"
            : "right"
          : dy < 0
            ? "jump"
            : "duck",
      );
    };
    this.input.keyboard?.on("keydown", keyboard);
    this.input
      .on("pointerdown", down)
      .on("pointerup", up)
      .on("pointerupoutside", up);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", keyboard);
      this.input
        .off("pointerdown", down)
        .off("pointerup", up)
        .off("pointerupoutside", up);
      this.playing(false);
    });
    this.opts.onScoreChange?.(0);
    this.paint(0);
  }

  private label(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    comic = false,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: comic ? COMIC : BODY,
      fontSize: `${size}px`,
      color,
      fontStyle: comic ? "italic" : "bold",
      ...(comic
        ? { stroke: "#101631", strokeThickness: size > 30 ? 5 : 0 }
        : {}),
    });
  }

  private makeControls(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(INK).fillRect(0, 749, 390, 95);
    const controls: [string, string, Action, number][] = [
      ["←", "LANE", "left", 0x3cdae2],
      ["↑", "JUMP", "jump", 0xffdc52],
      ["↓", "DUCK", "duck", 0xff77a5],
      ["→", "LANE", "right", 0x3cdae2],
    ];
    controls.forEach(([symbol, name, action, color], i) => {
      const x = 52 + i * 95;
      this.add.rectangle(x + 2, 790, 81, 58, 0x050a1f).setDepth(5);
      const button = this.add
        .rectangle(x, 785, 81, 58, color)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
        .setDepth(5);
      this.label(x, 777, symbol, 27, "#18233c").setOrigin(0.5).setDepth(5);
      this.label(x, 799, name, 10, "#18233c").setOrigin(0.5).setDepth(5);
      button.on("pointerdown", () => {
        this.game.canvas.focus({ preventScroll: true });
        this.act(action);
        this.tweens.add({
          targets: button,
          scaleY: 0.9,
          duration: 70,
          yoyo: true,
        });
      });
    });
    this.label(
      195,
      829,
      "SWIPE / ARROWS / WASD  ·  KEEP YOUR HERO MOVING",
      10,
      "#d1deff",
    )
      .setOrigin(0.5)
      .setDepth(5);
  }

  private act(action: Action): void {
    const oldJump = this.model.jumpLeft,
      oldDuck = this.model.duckLeft,
      oldLane = this.model.lane;
    this.model.act(action);
    if (this.model.jumpLeft > oldJump) this.pop("THWIP!", 0xffdb51, 570);
    if (this.model.duckLeft > oldDuck) this.pop("SWISH!", 0x3ff2d0, 590);
    if (this.model.lane !== oldLane)
      this.burst(195 + (oldLane - 1) * 126, 696, 0x80ffef, 7);
  }

  private showIntro(): void {
    const art = this.add.graphics();
    polygon(art, [19, 254, 370, 237, 381, 521, 17, 541], 0x19204c, true, 0.94);
    art.lineStyle(3, 0x61edf5).strokeRect(28, 257, 334, 268);
    for (let y = 272; y < 510; y += 12)
      for (let x = 39; x < 350; x += 12)
        art.fillStyle(0x6976b8, 0.18).fillCircle(x, y, 1.6);
    const chip = this.label(
      195,
      279,
      "ISSUE #001  ·  YOUR FRIENDLY NEIGHBORHOOD RUNNER",
      10,
      "#9df8ec",
    ).setOrigin(0.5);
    const title = this.label(195, 307, "BOSTON", 66, "#fff0b8", true)
      .setOrigin(0.5, 0)
      .setAngle(-5);
    const sub = this.label(195, 368, "SURFERS", 68, "#ffda4f", true)
      .setOrigin(0.5, 0)
      .setAngle(-5);
    title.setShadow(4, 5, "#e64583", 0, true, true);
    sub.setShadow(4, 5, "#e64583", 0, true, true);
    const copy = this.label(
      195,
      464,
      "DODGE TRAINS. STACK COINS. OWN THE T.",
      13,
      "#ffffff",
    ).setOrigin(0.5);
    const button = this.add.container(195, 567);
    const shadow = this.add
      .rectangle(5, 6, 296, 65, INK)
      .setStrokeStyle(3, INK);
    const face = this.add
      .rectangle(0, 0, 296, 65, 0xffd34f)
      .setStrokeStyle(4, INK)
      .setInteractive({ useHandCursor: true });
    button
      .add([
        shadow,
        face,
        this.label(0, -2, "LET’S ROLL!", 29, "#192042", true)
          .setStroke("#192042", 0)
          .setOrigin(0.5),
      ])
      .setAngle(-3);
    const hint = this.label(
      195,
      624,
      "ENTER TO START  /  SWIPE TO SURVIVE",
      12,
      "#fff6de",
    )
      .setStroke("#101631", 3)
      .setOrigin(0.5);
    face.on("pointerdown", () => this.startRun());
    this.overlay.add([art, chip, title, sub, copy, button, hint]);
    if (!this.reducedMotion)
      this.tweens.add({
        targets: button,
        y: 560,
        angle: -1,
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
  }

  private startRun(): void {
    this.overlay.removeAll(true);
    this.model.start();
    this.playing(true);
    this.game.canvas.focus({ preventScroll: true });
    this.pop("LET’S GO!", 0xffd749, 380);
  }

  private pop(message: string, color: number, y: number): void {
    const x = 195 + (this.model.lane - 1) * 65;
    const text = this.label(
      x,
      y,
      message,
      30,
      `#${color.toString(16).padStart(6, "0")}`,
      true,
    )
      .setOrigin(0.5)
      .setAngle(-9)
      .setDepth(9);
    this.tweens.add({
      targets: text,
      y: y - (this.reducedMotion ? 0 : 45),
      alpha: 0,
      scale: this.reducedMotion ? 1 : 1.15,
      duration: 650,
      ease: "Cubic.Out",
      onComplete: () => text.destroy(),
    });
  }

  private burst(x: number, y: number, color: number, count = 13): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * (70 + (i % 3) * 35),
        vy: Math.sin(angle) * 100 - 80,
        life: 0.65,
        color,
      });
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.clock += dt;
    this.model.tick(delta);
    this.visualLane +=
      (this.model.lane - this.visualLane) * Math.min(1, dt / 80);
    if (this.model.score !== this.lastScore) {
      this.lastScore = this.model.score;
      this.hud.setText(String(this.model.score).padStart(5, "0"));
      this.opts.onScoreChange?.(this.model.score);
    }
    if (this.model.coins > this.lastCoins) {
      this.lastCoins = this.model.coins;
      this.coinsText.setText(`★  ${this.model.coins}`);
      this.burst(195 + (this.visualLane - 1) * 126, 610, 0xffdf55);
      this.pop("+10! KA-CHING!", 0xffdf55, 510);
      if (!this.reducedMotion)
        this.tweens.add({
          targets: this.coinsText,
          scale: 1.2,
          duration: 100,
          yoyo: true,
        });
    }
    this.speedText.setText(
      `${Math.floor(this.model.speed)} M/S · ${this.model.speed > 22 ? "HERO MODE" : "LET’S ROLL"}`,
    );
    this.paint(dt);
    if (this.model.ended && !this.reported) {
      this.reported = true;
      this.playing(false);
      this.pop("WHAM!", 0xff547f, 450);
      this.burst(195 + (this.visualLane - 1) * 126, 620, 0xff6089, 22);
      if (!this.reducedMotion) this.cameras.main.shake(160, 0.005);
      // Parent UI owns immediate score + leaderboard and server-approved replays.
      this.opts.onGameOver(this.model.result());
    }
  }

  private paint(dt: number): void {
    const lean = this.model.lane - this.visualLane;
    drawWorld(
      this.world,
      this.model,
      this.reducedMotion ? this.model.durationMs : this.clock,
      lean,
    );
    drawHero(
      this.hero,
      195 + (this.visualLane - 1) * 126,
      TRACK.FEET,
      this.model,
      this.reducedMotion ? this.model.durationMs : this.clock,
      lean,
    );
    this.effects.clear();
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const s of this.sparks) {
      s.life -= dt / 1000;
      s.x += (s.vx * dt) / 1000;
      s.y += (s.vy * dt) / 1000;
      s.vy += (210 * dt) / 1000;
      this.effects
        .fillStyle(s.color, Math.max(0, s.life / 0.65))
        .fillRect(s.x, s.y, 5, 5);
    }
  }
}
