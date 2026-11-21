'use client';

import { GeoMap } from './GeoMap';
import { useTrains } from './useTrains';

export function LiveMap({ className = '' }: { className?: string }) {
  const { snapshot, mode } = useTrains();
  return (
    <div className={`relative h-full min-h-[360px] w-full ${className}`}>
      <GeoMap snapshot={snapshot} interactive />
      <p className="tracker-live-tag pointer-events-none absolute bottom-3 right-3 z-10">
        {mode === 'replay' ? 'replay' : 'live'} · {snapshot?.vehicles.length ?? 0} trains
      </p>
    </div>
  );
}
