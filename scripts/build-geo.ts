/**
 * Build the geographic map data (ARCHITECTURE §1 "Map").
 *
 *   pnpm tsx scripts/build-geo.ts
 *
 * Writes packages/shared/src/schematic/geo.json: real track shapes per route (Google-encoded
 * polylines from the MBTA API, decoded and Douglas-Peucker simplified) plus parent-station lat/lon
 * for every station in stations.json.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS, stations as stationsFile, type GeoFile, type RouteId } from '@cb/shared';
import { mbtaGet } from '../apps/web/lib/mbta/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/shared/src/schematic/geo.json');
for (const f of ['apps/web/.env.local', '.env.local']) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
const apiKey = process.env.MBTA_API_KEY || undefined;

type LL = [number, number]; // [lon, lat]

/** Google encoded polyline → [lon, lat][]. */
export function decodePolyline(str: string): LL[] {
  const out: LL[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lon / 1e5, lat / 1e5]);
  }
  return out;
}

/** Douglas-Peucker on a local metric plane (metres). */
export function simplify(pts: LL[], tolM: number): LL[] {
  if (pts.length < 3) return pts;
  const lat0 = pts[0]![1];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  const xy = pts.map(([lo, la]) => [lo * kx, la * ky] as const);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a]!;
    const [bx, by] = xy[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]!;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

type Rel = { data: { id: string; type: string } | null };
type Pattern = { attributes: { typicality: number }; relationships: { representative_trip: Rel; route: Rel } };
type Trip = { id: string; type: 'trip'; relationships: { shape: Rel } };
type Shape = { id: string; type: 'shape'; attributes: { polyline: string } };
type Res = { data: Pattern[]; included: (Trip | Shape)[] };

const geo: GeoFile = { version: 1, generatedAt: new Date().toISOString(), bbox: [0, 0, 0, 0], stations: {}, shapes: {} };

for (const route of ROUTE_IDS as readonly RouteId[]) {
  const res = await mbtaGet<Res>(
    '/route_patterns',
    { 'filter[route]': route, include: 'representative_trip.shape', 'fields[shape]': 'polyline' },
    { apiKey },
  );
  const trips = new Map(res.included.filter((i): i is Trip => i.type === 'trip').map((t) => [t.id, t]));
  const shapes = new Map(res.included.filter((i): i is Shape => i.type === 'shape').map((s) => [s.id, s]));
  const seen = new Set<string>();
  const lines: LL[][] = [];
  // Typicality 1 = main pattern, 2 = branch variations; both direction_ids trace the same track, so
  // we keep one shape per distinct geometry (dedupe by id, and drop near-duplicate opposite directions).
  for (const p of res.data.filter((p) => p.attributes.typicality <= 2 && p.relationships.route.data?.id === route)) {
    const sid = trips.get(p.relationships.representative_trip.data?.id ?? '')?.relationships.shape.data?.id;
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    const poly = shapes.get(sid)?.attributes.polyline;
    if (!poly) continue;
    const pts = simplify(decodePolyline(poly), 7).map(([lo, la]) => [r5(lo), r5(la)] as LL);
    if (pts.length > 1) lines.push(pts);
  }
  geo.shapes[route] = lines;
  console.log(`${route.padEnd(8)} ${lines.length} shapes, ${lines.reduce((n, l) => n + l.length, 0)} pts`);
}

// Parent station coordinates.
const ids = new Set<string>();
const names: Record<string, string> = {};
for (const dirs of Object.values(stationsFile.routes))
  for (const d of ['0', '1'] as const) for (const s of dirs?.[d] ?? []) (ids.add(s.id), (names[s.id] = s.name));
const st = await mbtaGet<{ data: { id: string; attributes: { name: string; latitude: number; longitude: number } }[] }>(
  '/stops',
  { 'filter[id]': [...ids].join(','), 'fields[stop]': 'name,latitude,longitude' },
  { apiKey },
);
for (const s of st.data) geo.stations[s.id] = { name: names[s.id] ?? s.attributes.name, lat: r5(s.attributes.latitude), lon: r5(s.attributes.longitude) };
const missing = [...ids].filter((id) => !geo.stations[id]);
if (missing.length) console.warn('missing stations:', missing.join(', '));

const all: LL[] = [...Object.values(geo.shapes).flatMap((ls) => ls.flat()), ...Object.values(geo.stations).map((s): LL => [s.lon, s.lat])];
geo.bbox = [
  r5(Math.min(...all.map((p) => p[0]))),
  r5(Math.min(...all.map((p) => p[1]))),
  r5(Math.max(...all.map((p) => p[0]))),
  r5(Math.max(...all.map((p) => p[1]))),
];
const json = JSON.stringify(geo);
writeFileSync(OUT, json + '\n');
console.log(`wrote geo.json: ${Object.keys(geo.stations).length} stations, ${(json.length / 1024).toFixed(0)} KB, bbox ${geo.bbox.join(', ')}`);
