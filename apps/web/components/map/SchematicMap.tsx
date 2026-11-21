'use client';

import {
  HUD_BACKGROUND,
  TRANSFER_STATIONS,
  isRouteId,
  layout,
  routeColor,
  stations,
  type RouteId,
  type TrainSnapshot,
} from '@cb/shared';
import { memo, useMemo } from 'react';
import { vehiclePoint } from '@/lib/mbta/placement';

const TRANSFER_IDS = new Set(TRANSFER_STATIONS.map((t) => t.stationId));

/** Station id → name, from stations.json. */
const NAMES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const dirs of Object.values(stations.routes)) for (const s of dirs?.['0'] ?? []) out[s.id] = s.name;
  return out;
})();

/** Termini get labels too. */
const TERMINI = new Set(Object.values(layout.paths).flatMap((ps) => (ps ?? []).flatMap((p) => [p[0], p.at(-1)])));

const StaticLayer = memo(function StaticLayer({ showAllLabels }: { showAllLabels: boolean }) {
  const lines = Object.entries(layout.paths) as [RouteId, string[][]][];
  return (
    <g>
      {lines.map(([route, polylines]) =>
        polylines.map((ids, i) => {
          const pts = ids.map((id) => layout.stations[id]).filter((p): p is { x: number; y: number } => !!p);
          return (
            <polyline
              key={`${route}-${i}`}
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={routeColor(route)}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
              filter="url(#glow)"
            />
          );
        }),
      )}
      {Object.entries(layout.stations).map(([id, p]) => {
        const transfer = TRANSFER_IDS.has(id);
        const label = showAllLabels || transfer || TERMINI.has(id);
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={transfer ? 7 : 3.5} fill={HUD_BACKGROUND} stroke="#e6ebf5" strokeWidth={transfer ? 2.5 : 1.5} />
            {label && (
              <text x={p.x + 10} y={p.y - 8} fill="#8a94ab" fontSize={transfer ? 15 : 12} fontFamily="ui-sans-serif, system-ui">
                {NAMES[id] ?? id}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

export function SchematicMap({
  snapshot,
  youVehicleId,
  showAllLabels = false,
  className = '',
}: {
  snapshot: TrainSnapshot | null;
  youVehicleId?: string | null;
  showAllLabels?: boolean;
  className?: string;
}) {
  const trains = useMemo(
    () =>
      (snapshot?.vehicles ?? [])
        .map((v) => ({ v, p: vehiclePoint(v, layout) }))
        .filter((t): t is { v: (typeof t)['v']; p: { x: number; y: number } } => t.p !== null),
    [snapshot],
  );
  const empty = Object.keys(layout.stations).length === 0;

  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className={`h-full w-full ${className}`} role="img" aria-label="Live MBTA map">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {empty ? (
        <text x={layout.width / 2} y={layout.height / 2} textAnchor="middle" fill="#8a94ab" fontSize={28}>
          Run scripts/build-stations.ts to generate the schematic
        </text>
      ) : (
        <StaticLayer showAllLabels={showAllLabels} />
      )}
      <g>
        {trains.map(({ v, p }) => {
          const you = v.id === youVehicleId;
          const color = isRouteId(v.route) ? routeColor(v.route) : '#ffffff';
          return (
            <g key={v.id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 1s ease-in-out' }}>
              {you && (
                <>
                  <circle r={14} fill="none" stroke="#ffffff" strokeWidth={3}>
                    <animate attributeName="r" values="12;26;12" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.1;1" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <text y={-22} textAnchor="middle" fill="#ffffff" fontSize={18} fontWeight={700} fontFamily="ui-monospace, monospace">
                    YOU
                  </text>
                </>
              )}
              <circle r={you ? 9 : 6} fill={color} stroke="#ffffff" strokeWidth={you ? 3 : 1.5} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
