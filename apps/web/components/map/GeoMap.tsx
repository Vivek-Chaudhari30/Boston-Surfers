'use client';

import {
  HUD_BACKGROUND,
  TRANSFER_STATIONS,
  geo,
  isRouteId,
  layout,
  lineOfRoute,
  routeColor,
  stations as stationsFile,
  type Line,
  type RouteId,
  type TrainSnapshot,
  type TrainVehicle,
} from '@cb/shared';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { SchematicMap } from './SchematicMap';
import {
  MIN_TILE_Z,
  TILE_SOURCE,
  buildGeoIndex,
  clampZoom,
  fitView,
  placeTrain,
  project,
  tileUrl,
  tileZoomFor,
  viewScale,
  viewTransform,
  visibleTiles,
  type GeoIndex,
  type Placed,
  type Tile,
  type View,
} from './geo';

/** Size multiplier per variant: the kiosk is read from across a train car. */
const K = { default: 1, kiosk: 1.6 } as const;
export type GeoMapVariant = keyof typeof K;

const MAX_ZOOM = 16.5;
/** Turns the light OSM raster into a dark navy-ish basemap. */
const DARKEN = 'invert(1) hue-rotate(188deg) brightness(0.95) contrast(0.92) saturate(0.55)';
const ZOOM_BTN = 'h-8 w-8 rounded-md border border-hud-border bg-hud-panel/85 text-base text-hud-text backdrop-blur transition hover:border-hud-dim';
const FONT = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Brand colors lightened a touch so Blue and Green still glow on a dark basemap. */
const LIFT: Record<Line, number> = { Red: 0.1, Orange: 0.04, Blue: 0.38, Green: 0.2 };
function mix(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function glowColor(route: string): string {
  return isRouteId(route) ? mix(routeColor(route), LIFT[lineOfRoute(route)]) : '#ffffff';
}
const LINE_NAMES: Record<Line, string> = { Red: 'Red Line', Orange: 'Orange Line', Blue: 'Blue Line', Green: 'Green Line' };
function routeName(route: string): string {
  if (!isRouteId(route)) return route;
  return route.startsWith('Green-') ? `Green Line ${route.slice(6)}` : LINE_NAMES[lineOfRoute(route)];
}

// --- static data derived once -----------------------------------------------------------------

const INDEX: GeoIndex | null = (() => {
  if (!geo.generatedAt || Object.keys(geo.stations).length === 0) return null;
  return buildGeoIndex(geo);
})();

type Kind = 'transfer' | 'hub' | 'terminal' | 'minor';
const STATION_INFO = (() => {
  const routesAt = new Map<string, Set<RouteId>>();
  for (const [r, dirs] of Object.entries(stationsFile.routes))
    for (const d of ['0', '1'] as const) for (const s of dirs?.[d] ?? []) (routesAt.get(s.id) ?? routesAt.set(s.id, new Set()).get(s.id)!).add(r as RouteId);
  const termini = new Set(Object.values(layout.paths).flatMap((ps) => (ps ?? []).flatMap((p) => [p[0], p.at(-1)])));
  const transferIds = new Set(TRANSFER_STATIONS.map((t) => t.stationId));
  const out: Record<string, { kind: Kind; color: string }> = {};
  for (const id of Object.keys(geo.stations)) {
    const routes = [...(routesAt.get(id) ?? [])];
    const lines = new Set(routes.map(lineOfRoute));
    const kind: Kind = transferIds.has(id) || lines.size > 1 ? 'transfer' : routes.length > 1 ? 'hub' : termini.has(id) ? 'terminal' : 'minor';
    out[id] = { kind, color: routes[0] ? mix(routeColor(routes[0]), LIFT[lineOfRoute(routes[0])]) : '#e6ebf5' };
  }
  return out;
})();

/** Route paths in REF_Z world px, one `d` string per shape. */
const ROUTE_PATHS = (() => {
  const out: { route: RouteId; d: string; color: string; green: boolean }[] = [];
  if (!INDEX) return out;
  for (const [route, polys] of Object.entries(INDEX.shapes) as [RouteId, NonNullable<GeoIndex['shapes'][RouteId]>][]) {
    const color = glowColor(route);
    polys.forEach((poly) => {
      const d = poly.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
      out.push({ route, d, color, green: route.startsWith('Green') });
    });
  }
  return out;
})();
const BBOX_WORLD = (() => {
  const a = project(geo.bbox[0], geo.bbox[3]);
  const b = project(geo.bbox[2], geo.bbox[1]);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
})();

// --- layers -----------------------------------------------------------------------------------

const TileLayer = memo(
  function TileLayer({ tiles }: { tiles: Tile[]; sig: string }) {
    return (
      <g>
        {tiles.map((t) => (
          <image
            key={t.key}
            href={tileUrl(t)}
            x={t.wx - 0.4}
            y={t.wy - 0.4}
            width={t.size + 0.8}
            height={t.size + 0.8}
            preserveAspectRatio="none"
            style={{ opacity: 0, transition: 'opacity 500ms ease-out' }}
            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
            // Offline: leave the dark background, lines and trains showing.
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ))}
      </g>
    );
  },
  (a, b) => a.sig === b.sig,
);

const RouteLayer = memo(function RouteLayer({ k, glow }: { k: number; glow: boolean }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {glow && (
        <g filter="url(#route-blur)" opacity={0.7}>
          {ROUTE_PATHS.map((r, i) => (
            <path key={i} d={r.d} stroke={r.color} strokeWidth={(r.green ? 8 : 10) * k} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
      {ROUTE_PATHS.map((r, i) => (
        <path key={`c${i}`} d={r.d} stroke={HUD_BACKGROUND} strokeOpacity={0.9} strokeWidth={(r.green ? 6.5 : 8) * k} vectorEffect="non-scaling-stroke" />
      ))}
      {ROUTE_PATHS.map((r, i) => (
        <path key={`l${i}`} d={r.d} stroke={r.color} strokeWidth={(r.green ? 3.4 : 4.4) * k} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
});

type LabelSpot = { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' };

/** Greedy collision-free label placement in screen px (depends on scale only, not on panning). */
function placeLabels(scale: number, zoom: number, k: number, showMinor: boolean): Map<string, LabelSpot> {
  const spots = new Map<string, LabelSpot>();
  if (!INDEX) return spots;
  const rank: Record<Kind, number> = { transfer: 0, hub: 1, terminal: 2, minor: 3 };
  const ids = Object.keys(STATION_INFO)
    .filter((id) => showMinor || STATION_INFO[id]!.kind !== 'minor')
    .sort((a, b) => rank[STATION_INFO[a]!.kind] - rank[STATION_INFO[b]!.kind]);
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  void zoom;
  for (const id of ids) {
    const p = INDEX.stations[id]!;
    const kind = STATION_INFO[id]!.kind;
    const fs = (kind === 'minor' ? 10.5 : 12.5) * k;
    const r = (kind === 'transfer' ? 7 : kind === 'hub' ? 5.5 : 4) * k;
    const w = (geo.stations[id]?.name.length ?? 6) * fs * 0.56;
    const h = fs * 1.2;
    const sx = p.x * scale;
    const sy = p.y * scale;
    const options: (LabelSpot & { box: [number, number] })[] = [
      { dx: r + 5 * k, dy: 0, anchor: 'start', box: [r + 5 * k, 0] },
      { dx: -(r + 5 * k), dy: 0, anchor: 'end', box: [-(r + 5 * k) - w, 0] },
      { dx: 0, dy: -(r + 7 * k), anchor: 'middle', box: [-w / 2, -(r + 7 * k)] },
      { dx: 0, dy: r + 7 * k + fs * 0.5, anchor: 'middle', box: [-w / 2, r + 7 * k + fs * 0.5] },
    ];
    for (const o of options) {
      const x0 = sx + o.box[0];
      const y0 = sy + o.dy - h / 2;
      const rect = { x0, y0, x1: x0 + w, y1: y0 + h };
      // Keep labels inside the network's right edge so Braintree / Wonderland are never clipped.
      if (rect.x1 > BBOX_WORLD.x1 * scale + 24 * k) continue;
      if (!placed.some((q) => rect.x0 < q.x1 && rect.x1 > q.x0 && rect.y0 < q.y1 && rect.y1 > q.y0)) {
        placed.push(rect);
        spots.set(id, { dx: o.dx, dy: o.dy, anchor: o.anchor });
        break;
      }
    }
  }
  return spots;
}

const StationLayer = memo(function StationLayer({
  scale,
  zoom,
  k,
  showMinor,
  onHover,
}: {
  scale: number;
  zoom: number;
  k: number;
  showMinor: boolean;
  onHover: ((id: string | null) => void) | null;
}) {
  const spots = useMemo(() => placeLabels(scale, zoom, k, showMinor), [scale, zoom, k, showMinor]);
  if (!INDEX) return null;
  const inv = 1 / scale;
  // Draw minor first so transfers sit on top.
  const order: Kind[] = ['minor', 'terminal', 'hub', 'transfer'];
  const ids = Object.keys(STATION_INFO).sort((a, b) => order.indexOf(STATION_INFO[a]!.kind) - order.indexOf(STATION_INFO[b]!.kind));
  return (
    <g>
      {ids.map((id) => {
        const p = INDEX!.stations[id]!;
        const { kind, color } = STATION_INFO[id]!;
        const spot = spots.get(id);
        const major = kind !== 'minor';
        const r = (kind === 'transfer' ? 6.5 : kind === 'hub' ? 5 : kind === 'terminal' ? 4.4 : 3.2) * k;
        const stroke = kind === 'transfer' || kind === 'hub' ? '#ffffff' : kind === 'terminal' ? '#ffffff' : color;
        return (
          <g
            key={id}
            transform={`translate(${p.x} ${p.y}) scale(${inv})`}
            onPointerEnter={onHover ? (e) => e.pointerType === 'mouse' && onHover(id) : undefined}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
          >
            <circle r={r} fill={HUD_BACKGROUND} stroke={stroke} strokeWidth={(kind === 'transfer' ? 2.6 : kind === 'minor' ? 1.5 : 2) * k} />
            {kind === 'transfer' && <circle r={r - 3.6 * k} fill="#ffffff" fillOpacity={0.18} />}
            {onHover && <circle r={Math.max(r + 4, 9)} fill="transparent" />}
            {spot && (
              <text
                x={spot.dx}
                y={spot.dy}
                textAnchor={spot.anchor}
                dominantBaseline="central"
                fontFamily={FONT}
                fontSize={(major ? 12.5 : 10.5) * k}
                fontWeight={kind === 'transfer' ? 700 : major ? 600 : 500}
                fill={major ? '#eef2fb' : '#b4bdd2'}
                stroke={HUD_BACKGROUND}
                strokeWidth={(major ? 3.4 : 3) * k}
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {geo.stations[id]?.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type TrainItem = { v: TrainVehicle; p: Placed; color: string };

const TrainLayer = memo(function TrainLayer({
  trains,
  scale,
  k,
  youId,
  onHover,
  onPick,
}: {
  trains: TrainItem[];
  scale: number;
  k: number;
  youId: string | null;
  onHover: ((v: TrainVehicle | null) => void) | null;
  onPick: ((v: TrainVehicle) => void) | null;
}) {
  const inv = 1 / scale;
  return (
    <g>
      {trains.map(({ v, p, color }) => {
        const you = v.id === youId;
        const boost = you ? 1.45 : 1;
        const delay = `${-(hash(v.id) % 2400) / 1000}s`;
        return (
          <g
            key={v.id}
            style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 1s ease-in-out', cursor: onPick ? 'pointer' : undefined }}
            onPointerEnter={onHover ? (e) => e.pointerType === 'mouse' && onHover(v) : undefined}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
            onClick={onPick ? () => onPick(v) : undefined}
          >
            <g transform={`scale(${inv})`}>
              {p.heading !== null && (
                <g transform={`rotate(${p.heading.toFixed(0)})`}>
                  <rect x={-30 * k * boost} y={-2.6 * k * boost} width={30 * k * boost} height={5.2 * k * boost} rx={2.6 * k} fill={`url(#tail-${v.route})`} />
                </g>
              )}
              <circle r={10 * k * boost} fill={color} opacity={0.28}>
                <animate attributeName="r" values={`${8 * k * boost};${13 * k * boost};${8 * k * boost}`} dur="2.4s" begin={delay} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.08;0.4" dur="2.4s" begin={delay} repeatCount="indefinite" />
              </circle>
              {you && (
                <>
                  <circle r={14 * k} fill="none" stroke="#ffffff" strokeWidth={2.4 * k}>
                    <animate attributeName="r" values={`${12 * k};${30 * k};${12 * k}`} dur="1.7s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.05;1" dur="1.7s" repeatCount="indefinite" />
                  </circle>
                  <rect x={-23 * k} y={-(46 * k)} width={46 * k} height={20 * k} rx={10 * k} fill={HUD_BACKGROUND} fillOpacity={0.92} stroke="#ffffff" strokeWidth={1.4} />
                  <text y={-(36 * k)} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={12.5 * k} fontWeight={700} fontFamily={MONO} letterSpacing={1}>
                    YOU
                  </text>
                </>
              )}
              <circle r={4.6 * k * boost} fill={color} stroke="#ffffff" strokeWidth={(you ? 2.2 : 1.5) * (k > 1 ? 1.25 : 1)} />
              {onHover && <circle r={13} fill="transparent" />}
            </g>
          </g>
        );
      })}
    </g>
  );
});

// --- component --------------------------------------------------------------------------------

function nextStationLine(v: TrainVehicle): string {
  const name = geo.stations[v.stationId]?.name ?? v.stationId;
  if (v.status === 'STOPPED_AT') return `At ${name}`;
  if (v.status === 'INCOMING_AT') return `Arriving at ${name}`;
  return `→ ${name}`;
}

export function GeoMap(props: {
  snapshot: TrainSnapshot | null;
  youVehicleId?: string | null;
  variant?: GeoMapVariant;
  interactive?: boolean;
  className?: string;
}) {
  if (!INDEX || ROUTE_PATHS.length === 0) {
    return <SchematicMap snapshot={props.snapshot} youVehicleId={props.youVehicleId} variant={props.variant} className={props.className} />;
  }
  return <GeoMapInner {...props} />;
}

function GeoMapInner({ snapshot, youVehicleId = null, variant = 'default', interactive = false, className = '' }: Parameters<typeof GeoMap>[0]) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [userView, setUserView] = useState<View | null>(null);
  const [moving, setMoving] = useState(false);
  const [hoverTrain, setHoverTrain] = useState<TrainVehicle | null>(null);
  const [pinned, setPinned] = useState<TrainVehicle | null>(null);
  const [hoverStation, setHoverStation] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  // The kiosk is 1.6x for a 1080p screen; shrink gracefully on smaller windows.
  const k = variant === 'kiosk' ? Math.max(1, Math.min(K.kiosk, h / 620)) : K.default;
  const fit = useMemo(
    () =>
      fitView(geo.bbox, w || 1, h || 1, {
        left: 28 * k,
        top: 34 * k,
        right: 100 * k,
        bottom: 34 * k,
      }),
    [w, h, k],
  );
  const view = userView ?? fit;
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  const minZoom = fit.zoom - 0.6;

  const trains = useMemo<TrainItem[]>(() => {
    const out: TrainItem[] = [];
    for (const v of snapshot?.vehicles ?? []) {
      const p = placeTrain(v, INDEX!);
      if (p) out.push({ v, p, color: glowColor(v.route) });
    }
    return out.sort((a, b) => Number(a.v.id === youVehicleId) - Number(b.v.id === youVehicleId));
  }, [snapshot, youVehicleId]);

  // --- interaction -----------------------------------------------------------------------------
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touch = useCallback(() => {
    setMoving(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setMoving(false), 200);
  }, []);
  useEffect(() => () => clearTimeout(idle.current), []);

  const clampView = useCallback((v: View): View => {
    const mx = (BBOX_WORLD.x1 - BBOX_WORLD.x0) * 0.2;
    const my = (BBOX_WORLD.y1 - BBOX_WORLD.y0) * 0.2;
    return {
      zoom: clampZoom(v.zoom, minZoom, MAX_ZOOM),
      cx: Math.max(BBOX_WORLD.x0 - mx, Math.min(BBOX_WORLD.x1 + mx, v.cx)),
      cy: Math.max(BBOX_WORLD.y0 - my, Math.min(BBOX_WORLD.y1 + my, v.cy)),
    };
  }, [minZoom]);

  const zoomAt = useCallback(
    (sx: number, sy: number, zoom: number) => {
      const cur = viewRef.current;
      const { scale, tx, ty } = viewTransform(cur, size.w, size.h);
      const nz = clampZoom(zoom, minZoom, MAX_ZOOM);
      const ns = viewScale(nz);
      const wx = (sx - tx) / scale;
      const wy = (sy - ty) / scale;
      setUserView(clampView({ zoom: nz, cx: wx - (sx - size.w / 2) / ns, cy: wy - (sy - size.h / 2) / ns }));
      touch();
    },
    [size.w, size.h, minZoom, clampView, touch],
  );
  const zoomAtRef = useRef(zoomAt);
  useEffect(() => {
    zoomAtRef.current = zoomAt;
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      // Plain wheel scrolls the page (the map is a full-bleed hero). Pinch (ctrlKey) or ⌘/Ctrl+wheel zooms.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dz = -e.deltaY * (e.ctrlKey ? 0.012 : 0.0032);
      zoomAtRef.current(e.clientX - r.left, e.clientY - r.top, viewRef.current.zoom + dz);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dragged: false, startX: 0, startY: 0, pinchDist: 0 });

  const onPointerDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { dragged: false, startX: e.clientX, startY: e.clientY, pinchDist: 0 };
  };
  const onPointerMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const r = rootRef.current!.getBoundingClientRect();
    const pts = pointers.current;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesture.current;
      if (g.pinchDist > 0 && dist > 0) {
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, viewRef.current.zoom + Math.log2(dist / g.pinchDist));
      }
      g.pinchDist = dist;
      g.dragged = true;
      return;
    }
    const g = gesture.current;
    if (!g.dragged && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4) return;
    if (!g.dragged) {
      g.dragged = true;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    const cur = viewRef.current;
    const s = viewScale(cur.zoom);
    setUserView(clampView({ ...cur, cx: cur.cx - (e.clientX - prev.x) / s, cy: cur.cy - (e.clientY - prev.y) / s }));
    touch();
    setHoverTrain(null);
  };
  const onPointerUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current.pinchDist = 0;
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, viewRef.current.zoom + 1);
  };
  const stepZoom = useCallback((d: number) => zoomAt(size.w / 2, size.h / 2, viewRef.current.zoom + d), [zoomAt, size.w, size.h]);

  // --- render ----------------------------------------------------------------------------------
  const ready = w > 1 && h > 1;
  const { scale, tx, ty } = viewTransform(view, w, h);
  const tz = tileZoomFor(view.zoom);
  const upper = ready ? visibleTiles(view, w, h, 160) : [];
  const lower = ready && tz > MIN_TILE_Z ? visibleTiles(view, w, h, 160, tz - 1) : [];
  const upperSig = upper.map((t) => t.key).join('|');
  const lowerSig = lower.map((t) => t.key).join('|');

  const onPick = useCallback((v: TrainVehicle) => {
    if (gesture.current.dragged) return;
    setPinned((p) => (p?.id === v.id ? null : v));
  }, []);
  const tipTrain = hoverTrain ?? pinned;
  const tipPlaced = tipTrain ? trains.find((t) => t.v.id === tipTrain.id) : undefined;
  const tip = tipPlaced
    ? {
        x: tipPlaced.p.x * scale + tx,
        y: tipPlaced.p.y * scale + ty,
        color: tipPlaced.color,
        title: routeName(tipTrain!.route),
        sub: nextStationLine(tipTrain!),
        meta: tipTrain!.label ? `Train ${tipTrain!.label}` : '',
      }
    : hoverStation && INDEX!.stations[hoverStation]
      ? {
          x: INDEX!.stations[hoverStation]!.x * scale + tx,
          y: INDEX!.stations[hoverStation]!.y * scale + ty,
          color: STATION_INFO[hoverStation]!.color,
          title: geo.stations[hoverStation]!.name,
          sub: '',
          meta: '',
        }
      : null;

  const routeNames = [...new Set(trains.map((t) => t.v.route))];
  const showMinor = variant === 'default' && view.zoom >= 12.6;

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-hud-bg ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      style={interactive ? { touchAction: 'none' } : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerUp : undefined}
      onDoubleClick={interactive ? onDoubleClick : undefined}
    >
      <svg width={w} height={h} className="absolute inset-0 block select-none" role="img" aria-label="Live MBTA map" style={{ background: HUD_BACKGROUND }}>
        <defs>
          <filter id="route-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={5 * k} />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor={HUD_BACKGROUND} stopOpacity={0} />
            <stop offset="100%" stopColor={HUD_BACKGROUND} stopOpacity={0.75} />
          </radialGradient>
          {routeNames.map((r) => (
            <linearGradient key={r} id={`tail-${r}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={glowColor(r)} stopOpacity={0} />
              <stop offset="1" stopColor={glowColor(r)} stopOpacity={0.85} />
            </linearGradient>
          ))}
        </defs>
        {ready && (
          <>
            <g transform={`translate(${tx} ${ty}) scale(${scale})`} style={{ filter: TILE_SOURCE.dark ? 'brightness(1.4) contrast(1.1)' : DARKEN }}>
              {lower.length > 0 && <TileLayer tiles={lower} sig={`L${lowerSig}`} />}
              <TileLayer tiles={upper} sig={`U${upperSig}`} />
            </g>
            {/* Tint the basemap toward the HUD palette and dim it so the lines are the loudest thing. */}
            <rect width={w} height={h} fill="#0a1430" opacity={0.28} />
            <rect width={w} height={h} fill="url(#vignette)" pointerEvents="none" />
            <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
              <RouteLayer k={k} glow={!moving} />
              <StationLayer scale={scale} zoom={view.zoom} k={k} showMinor={showMinor} onHover={interactive ? setHoverStation : null} />
              <TrainLayer
                trains={trains}
                scale={scale}
                k={k}
                youId={youVehicleId}
                onHover={interactive ? setHoverTrain : null}
                onPick={interactive ? onPick : null}
              />
            </g>
          </>
        )}
      </svg>

      <p
        className="pointer-events-none absolute bottom-1.5 left-2 font-sans text-[10px] leading-none text-hud-dim/60"
        style={{ fontSize: 10 * Math.min(k, 1.3) }}
      >
        {TILE_SOURCE.attribution}
      </p>

      {interactive && (
        <div className="absolute bottom-8 right-3 flex flex-col gap-1.5 font-mono text-xs" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <span className="pointer-events-none hidden text-right text-[10px] text-hud-dim/70 lg:block">⌘/Ctrl + scroll</span>
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => stepZoom(0.8)} className={ZOOM_BTN}>
            +
          </button>
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => stepZoom(-0.8)} className={ZOOM_BTN}>
            −
          </button>
          {userView && (
            <button
              type="button"
              onClick={() => {
                setUserView(null);
                setPinned(null);
              }}
              className="rounded-md border border-hud-border bg-hud-panel/85 px-2 py-1.5 text-hud-text backdrop-blur transition hover:border-hud-dim"
            >
              reset
            </button>
          )}
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-10 min-w-28 rounded-lg border border-hud-border bg-hud-panel/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: Math.max(8, Math.min(w - 190, tip.x + 14)),
            top: Math.max(8, Math.min(h - 70, tip.y - 14)),
            boxShadow: `0 0 18px ${tip.color}44`,
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-hud-text">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: tip.color, boxShadow: `0 0 8px ${tip.color}` }} />
            {tip.title}
          </p>
          {tip.sub && <p className="mt-0.5 text-xs text-hud-text/90">{tip.sub}</p>}
          {tip.meta && <p className="mt-0.5 font-mono text-[10px] text-hud-dim">{tip.meta}</p>}
        </div>
      )}
    </div>
  );
}
