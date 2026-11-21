'use client';

import { SchematicMap } from './SchematicMap';
import { useTrains } from './useTrains';

export function LiveMap() {
  const { snapshot, mode } = useTrains();
  return (
    <div className="relative aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[60vh]">
      <SchematicMap snapshot={snapshot} />
      <p className="absolute bottom-2 right-3 font-mono text-xs text-hud-dim">
        {mode === 'replay' ? 'replay' : 'live'} · {snapshot?.vehicles.length ?? 0} trains
      </p>
    </div>
  );
}
