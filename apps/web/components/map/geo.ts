/**
 * Pure geometry for the geographic map: Web-Mercator projection, the fixed network frame, tile
 * selection, and train placement along the real track shapes. No React, no DOM.
 *
 * All drawing happens in "reference world" pixels (Web-Mercator at REF_Z); the component applies a
 * single translate+scale to get to the screen, so paths are projected once.
 */
import type { GeoFile, RouteId, TrainVehicle } from '@cb/shared';

export const REF_Z = 14;
export const TILE = 256;
export const MIN_TILE_Z = 10;
export const MAX_TILE_Z = 16;

export type XY = { x: number; y: number };
export type LonLat = { lon: number; lat: number };

const MAX_LAT = 85.0511287798;

export function worldSize(z: number): number {
  return TILE * 2 ** z;
}

/** lon/lat → Web-Mercator pixels at zoom z (z may be fractional). */
export function project(lon: number, lat: number, z: number = REF_Z): XY {
  const s = worldSize(z);
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((la * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}

export function unproject(x: number, y: number, z: number = REF_Z): LonLat {
  const s = worldSize(z);
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lon, lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI };
}

/** A view: map center (in REF_Z world px) and a fractional zoom. scale = 2^(zoom - REF_Z). */
export type View = { cx: number; cy: number; zoom: number };

export function viewScale(zoom: number): number {
  return 2 ** (zoom - REF_Z);
}

/** Screen px → transform parameters: screen = world * scale + (tx, ty). */
export function viewTransform(view: View, w: number, h: number): { scale: number; tx: number; ty: number } {
  const scale = viewScale(view.zoom);
  return { scale, tx: w / 2 - view.cx * scale, ty: h / 2 - view.cy * scale };
}

/** Fixed frame that covers the bbox [minLon,minLat,maxLon,maxLat] inside w×h with padding (px per side). */
export function fitView(
  bbox: readonly [number, number, number, number],
  w: number,
  h: number,
  pad: { left: number; right: number; top: number; bottom: number } | number = 24,
): View {
  const p = typeof pad === 'number' ? { left: pad, right: pad, top: pad, bottom: pad } : pad;
  const a = project(bbox[0], bbox[3]); // top-left
  const b = project(bbox[2], bbox[1]); // bottom-right
  const bw = Math.max(1e-6, b.x - a.x);
  const bh = Math.max(1e-6, b.y - a.y);
  const availW = Math.max(10, w - p.left - p.right);
  const availH = Math.max(10, h - p.top - p.bottom);
  const scale = Math.min(availW / bw, availH / bh);
  // Center the bbox inside the padded area.
  const midX = (a.x + b.x) / 2 - (p.right - p.left) / 2 / scale;
  const midY = (a.y + b.y) / 2 - (p.bottom - p.top) / 2 / scale;
  return { cx: midX, cy: midY, zoom: REF_Z + Math.log2(scale) };
}

export function clampZoom(zoom: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, zoom));
}

/** Integer tile zoom that keeps @2x tiles sharp at a given view zoom. */
export function tileZoomFor(zoom: number): number {
  // 256 px sources need one step finer than @2x ones to look equally sharp.
  const z = TILE_SOURCE.retina ? Math.round(zoom) : Math.round(zoom + 0.5);
  return Math.max(MIN_TILE_Z, Math.min(MAX_TILE_Z, z));
}

export type Tile = { z: number; x: number; y: number; wx: number; wy: number; size: number; key: string };

/** Tiles intersecting the w×h viewport (plus `margin` px), positioned in REF_Z world px. */
export function visibleTiles(view: View, w: number, h: number, margin = 0, tz: number = tileZoomFor(view.zoom)): Tile[] {
  const { scale, tx, ty } = viewTransform(view, w, h);
  const size = TILE * 2 ** (REF_Z - tz); // tile edge in REF_Z world px
  const x0 = (-margin - tx) / scale;
  const x1 = (w + margin - tx) / scale;
  const y0 = (-margin - ty) / scale;
  const y1 = (h + margin - ty) / scale;
  const n = 2 ** tz;
  const out: Tile[] = [];
  const iy0 = Math.max(0, Math.floor(y0 / size));
  const iy1 = Math.min(n - 1, Math.floor(y1 / size));
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = Math.floor(x0 / size); ix <= Math.floor(x1 / size); ix++) {
      const wrapped = ((ix % n) + n) % n;
      out.push({ z: tz, x: wrapped, y: iy, wx: ix * size, wy: iy * size, size, key: `${tz}/${wrapped}/${iy}@${ix}` });
    }
  }
  return out;
}

/**
 * Basemap source. CARTO's dark raster tiles now return an "API KEY REQUIRED" watermark without a
 * key, so the default is the keyless OpenStreetMap standard raster, darkened with a CSS filter.
 * Set NEXT_PUBLIC_TILE_URL to a template with {s} {z} {x} {y} (and optionally {r} for "@2x") to use
 * a real dark style, e.g. CARTO with a key; NEXT_PUBLIC_TILE_DARK=1 skips the darkening filter.
 */
const CUSTOM_URL = process.env.NEXT_PUBLIC_TILE_URL || '';
export const TILE_SOURCE = CUSTOM_URL
  ? {
      template: CUSTOM_URL,
      dark: process.env.NEXT_PUBLIC_TILE_DARK === '1',
      retina: CUSTOM_URL.includes('{r}'),
      attribution: CUSTOM_URL.includes('cartocdn') ? '© OpenStreetMap contributors © CARTO' : '© OpenStreetMap contributors',
    }
  : {
      template: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: false,
      retina: false,
      attribution: '© OpenStreetMap contributors',
    };

const SUBDOMAINS = ['a', 'b', 'c', 'd'] as const;
export function tileUrl(t: Pick<Tile, 'z' | 'x' | 'y'>): string {
  const s = TILE_SOURCE.template.includes('tile.openstreetmap.org') ? SUBDOMAINS[(t.x + t.y) % 3] : SUBDOMAINS[(t.x + t.y) % SUBDOMAINS.length];
  return TILE_SOURCE.template
    .replace('{s}', s)
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
    .replace('{r}', '@2x');
}

// ---------------------------------------------------------------------------------------------
// Train placement
// ---------------------------------------------------------------------------------------------

type Poly = { pts: XY[]; cum: number[] };
export type GeoIndex = {
  stations: Record<string, XY>;
  shapes: Partial<Record<RouteId, Poly[]>>;
  /** (route|shapeIdx|station) → arc position & distance, filled lazily. */
  cache: Map<string, { s: number; d: number }>;
};

function makePoly(ll: [number, number][]): Poly {
  const pts = ll.map(([lon, lat]) => project(lon, lat));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return { pts, cum };
}

export function buildGeoIndex(geo: Pick<GeoFile, 'stations' | 'shapes'>): GeoIndex {
  const stations: Record<string, XY> = {};
  for (const [id, s] of Object.entries(geo.stations)) stations[id] = project(s.lon, s.lat);
  const shapes: GeoIndex['shapes'] = {};
  for (const [r, lines] of Object.entries(geo.shapes)) shapes[r as RouteId] = (lines ?? []).map(makePoly);
  return { stations, shapes, cache: new Map() };
}

/** Nearest point on the polyline: arc length position s and distance d (world px). */
export function snapToPoly(poly: Poly, p: XY): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < poly.pts.length; i++) {
    const a = poly.pts[i - 1]!;
    const b = poly.pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < best.d) best = { s: poly.cum[i - 1]! + t * Math.sqrt(l2), d };
  }
  return best;
}

/** Point and unit tangent at arc position s. */
export function pointAt(poly: Poly, s: number): { p: XY; tan: XY } {
  const total = poly.cum[poly.cum.length - 1] ?? 0;
  const ss = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < poly.cum.length - 1 && poly.cum[i]! < ss) i++;
  const a = poly.pts[i - 1]!;
  const b = poly.pts[i]!;
  const seg = poly.cum[i]! - poly.cum[i - 1]!;
  const t = seg === 0 ? 0 : (ss - poly.cum[i - 1]!) / seg;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tan: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
}

export type Placed = { lon: number; lat: number; x: number; y: number; /** degrees, SVG convention (0 = east, 90 = south); null if unknown */ heading: number | null };

const SNAP_MAX = 60; // ~400 m in REF_Z world px at Boston's latitude
const toDeg = (v: XY) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

function result(p: XY, heading: number | null): Placed {
  const ll = unproject(p.x, p.y);
  return { ...ll, x: p.x, y: p.y, heading };
}

/**
 * Where is this vehicle? Walks the real track shape between the previous and current station by
 * `progress`; falls back to a straight line, then to the station itself.
 */
export function placeTrain(v: Pick<TrainVehicle, 'route' | 'stationId' | 'prevStationId' | 'progress' | 'status'>, g: GeoIndex): Placed | null {
  const to = g.stations[v.stationId];
  if (!to) return null;
  const from = v.prevStationId ? g.stations[v.prevStationId] : undefined;
  if (!from || v.status === 'STOPPED_AT' || v.progress >= 1) return result(to, from ? toDeg({ x: to.x - from.x, y: to.y - from.y }) : null);
  const prog = Math.max(0, Math.min(1, v.progress));
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  const lerp: XY = { x: from.x + (to.x - from.x) * prog, y: from.y + (to.y - from.y) * prog };
  const straightHeading = straight > 0 ? toDeg({ x: to.x - from.x, y: to.y - from.y }) : null;

  const polys = g.shapes[v.route as RouteId] ?? [];
  let best: { poly: Poly; s0: number; s1: number; cost: number } | null = null;
  polys.forEach((poly, i) => {
    const snap = (id: string, pt: XY) => {
      const k = `${v.route}|${i}|${id}`;
      let c = g.cache.get(k);
      if (!c) g.cache.set(k, (c = snapToPoly(poly, pt)));
      return c;
    };
    const a = snap(v.prevStationId!, from);
    const b = snap(v.stationId, to);
    if (a.d > SNAP_MAX || b.d > SNAP_MAX) return;
    const cost = a.d + b.d;
    if (!best || cost < best.cost) best = { poly, s0: a.s, s1: b.s, cost };
  });
  const b = best as { poly: Poly; s0: number; s1: number; cost: number } | null;
  if (!b || Math.abs(b.s1 - b.s0) > straight * 3 + 120) return result(lerp, straightHeading);
  const { p, tan } = pointAt(b.poly, b.s0 + (b.s1 - b.s0) * prog);
  const dir = b.s1 >= b.s0 ? 1 : -1;
  return result(p, toDeg({ x: tan.x * dir, y: tan.y * dir }));
}
