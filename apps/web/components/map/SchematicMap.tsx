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
import { computeViewBox } from '@/components/kiosk/logic';

/** Label scale per variant: kiosk is read from a distance, so text and markers are 1.6x. */
const SCALE = { default: 1, kiosk: 1.6 } as const;
export type MapVariant = keyof typeof SCALE;

const TRANSFER_IDS = new Set(TRANSFER_STATIONS.map((t) => t.stationId));

/** Station id → name, from stations.json. */
const NAMES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const dirs of Object.values(stations.routes)) for (const s of dirs?.['0'] ?? []) out[s.id] = s.name;
  return out;
})();

/** Termini get labels too. */
const TERMINI = new Set(Object.values(layout.paths).flatMap((ps) => (ps ?? []).flatMap((p) => [p[0], p.at(-1)])));

const StaticLayer = memo(function StaticLayer({ showAllLabels, k }: { showAllLabels: boolean; k: number }) {
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
              strokeWidth={k > 1 ? 9 : 6}
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
            <circle cx={p.x} cy={p.y} r={(transfer ? 7 : 3.5) * k} fill={HUD_BACKGROUND} stroke="#e6ebf5" strokeWidth={(transfer ? 2.5 : 1.5) * k} />
            {label && (
              <text x={p.x + 10 * k} y={p.y - 8 * k} fill={k > 1 ? '#aab3c8' : '#8a94ab'} fontSize={(transfer ? 15 : 12) * k} fontFamily="ui-sans-serif, system-ui">
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
  variant = 'default',
}: {
  snapshot: TrainSnapshot | null;
  youVehicleId?: string | null;
  showAllLabels?: boolean;
  className?: string;
  variant?: MapVariant;
}) {
  const k = SCALE[variant];
  const trains = useMemo(
    () =>
      (snapshot?.vehicles ?? [])
        .map((v) => ({ v, p: vehiclePoint(v, layout) }))
        .filter((t): t is { v: (typeof t)['v']; p: { x: number; y: number } } => t.p !== null),
    [snapshot],
  );
  const empty = Object.keys(layout.stations).length === 0;
  // Crop to the stations (they only span part of the 1600x1000 canvas); leave room on the right for labels.
  const vb = useMemo(
    () =>
      computeViewBox(
        Object.values(layout.stations),
        { left: 30 * k, top: 40 * k, right: 150 * k, bottom: 30 * k },
        { width: layout.width, height: layout.height },
      ),
    [k],
  );

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className={`tracker-shell h-full w-full ${className}`} role="img" aria-label="Live MBTA map">
      <defs>
        <pattern id="schematic-comic-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#72bad7" strokeOpacity=".16" strokeWidth=".6"/></pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#10244a"/>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#schematic-comic-grid)"/>
      {empty ? (
        <text x={layout.width / 2} y={layout.height / 2} textAnchor="middle" fill="#8a94ab" fontSize={28}>
          Run scripts/build-stations.ts to generate the schematic
        </text>
      ) : (
        <StaticLayer showAllLabels={showAllLabels} k={k} />
      )}
      <g>
        {trains.map(({ v, p }) => {
          const you = v.id === youVehicleId;
          const color = isRouteId(v.route) ? routeColor(v.route) : '#ffffff';
          return (
            <g key={v.id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 1s ease-in-out' }}>
              {you && (
                <>
                  <circle r={14 * k} fill="none" stroke="#ffffff" strokeWidth={3 * (k > 1 ? 1.3 : 1)}>
                    <animate attributeName="r" values={`${12 * k};${26 * k};${12 * k}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.1;1" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  {k > 1 && <rect x={-30} y={-60} width={60} height={28} rx={14} fill={HUD_BACKGROUND} fillOpacity={0.9} stroke="#ffffff" strokeWidth={1.5} />}
                  <text y={-22 * k + (k > 1 ? -2 : 0)} textAnchor="middle" fill="#ffffff" fontSize={18 * (k > 1 ? 1.2 : 1)} fontWeight={700} fontFamily="ui-monospace, monospace">
                    YOU
                  </text>
                </>
              )}
              <circle r={(you ? 9 : 6) * (k > 1 ? 1.4 : 1)} fill={color} stroke="#ffffff" strokeWidth={you ? 3 : 1.5} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
