'use client';

import dynamic from 'next/dynamic';

// Phaser touches window at import time: load the harness client-only.
const GameHarness = dynamic(() => import('./GameHarness'), {
  ssr: false,
  loading: () => <p className="font-mono text-sm text-hud-dim">Loading game…</p>,
});

export function GameHarnessLoader() {
  return <GameHarness />;
}
