'use client';

import { GeoMap } from './GeoMap';
import { useTrains } from './useTrains';

export function LiveMap({ className = '' }: { className?: string }) {
  const { snapshot, mode } = useTrains();
  return (
    <div className={`relative h-full min-h-[360px] w-full ${className}`}>
      <GeoMap snapshot={snapshot} interactive />
      <p className="pointer-events-none absolute bottom-1.5 right-3 font-mono text-xs text-hud-dim">
        {mode === 'replay' ? 'replay' : 'live'} · {snapshot?.vehicles.length ?? 0} trains
      </p>
    </div>
  );
}
