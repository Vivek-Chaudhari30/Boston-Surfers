/**
 * @cb/game: framework-agnostic Phaser runner. Must NOT import React or Next.
 * Load it client-only (next/dynamic with ssr: false).
 *
 * The current implementation is a STUB ("Tap to score"). Jeet replaces it but must keep
 * the exported createRunner signature and the RunResult / RunnerOptions types.
 */
import * as Phaser from 'phaser';
import { VIEW } from './config';
import { STUB_SCENE_KEY, StubScene } from './scenes/StubScene';
import type { RunnerHandle, RunnerOptions } from './types';

export type { RunResult, RunnerOptions, RunnerHandle } from './types';

export function createRunner(parent: HTMLElement, opts: RunnerOptions): RunnerHandle {
  const scene = new StubScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW.WIDTH,
    height: VIEW.HEIGHT,
    backgroundColor: VIEW.BACKGROUND,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });

  // iOS Safari: stop swipes from scrolling the page.
  parent.style.touchAction = 'none';
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.style.touchAction = 'none';
  });

  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.destroy(true);
    },
    restart(seed: number) {
      if (destroyed) return;
      game.scene.start(STUB_SCENE_KEY, { seed });
    },
  };
}
