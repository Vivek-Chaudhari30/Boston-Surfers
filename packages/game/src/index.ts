/**
 * @cb/game: framework-agnostic Phaser runner. Must NOT import React or Next.
 * Load it client-only (next/dynamic with ssr: false).
 *
 * Seeded three-lane runner. Public contracts remain unchanged.
 */
import * as Phaser from 'phaser';
import { VIEW } from './config';
import { RUNNER_SCENE_KEY, RunnerScene } from './scenes/RunnerScene';
import type { RunnerHandle, RunnerOptions } from './types';

export type { RunResult, RunnerOptions, RunnerHandle } from './types';

let scrollLocks = 0;
let previousOverflow = '';

export function createRunner(parent: HTMLElement, opts: RunnerOptions): RunnerHandle {
  let locked = false;
  const playing = (active: boolean) => {
    if (active === locked) return;
    locked = active;
    if (active) {
      if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    } else if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
  };
  const scene = new RunnerScene(opts, playing);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW.WIDTH,
    height: VIEW.HEIGHT,
    backgroundColor: VIEW.BACKGROUND,
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });

  // iOS Safari: stop swipes from scrolling the page.
  const previousTouchAction = parent.style.touchAction;
  parent.style.touchAction = 'none';
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.style.touchAction = 'none';
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('role', 'application');
    game.canvas.setAttribute('aria-label', 'Boston Surfers. Enter to start. Arrow keys or WASD to move, jump, and duck.');
  });

  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      playing(false);
      game.destroy(true);
      parent.style.touchAction = previousTouchAction;
    },
    restart(seed: number) {
      if (destroyed) return;
      game.scene.start(RUNNER_SCENE_KEY, { seed });
    },
  };
}
