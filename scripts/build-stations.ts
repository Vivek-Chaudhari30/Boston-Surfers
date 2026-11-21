/**
 * Build the schematic from the MBTA API (ARCHITECTURE §2.3).
 *
 *   pnpm tsx scripts/build-stations.ts            # stations.json, and layout.json if it is empty
 *   pnpm tsx scripts/build-stations.ts --layout   # also regenerate layout.json (overwrites hand edits!)
 *
 * stations.json: for each route + direction, the canonical (typicality 1) patterns' parent stations
 *   in order. Branches are concatenated (see schematic/index.ts).
 * layout.json: a first-pass layout from real coordinates, projected onto 1600×1000 with a radial
 *   "fisheye" around downtown so the tight core spreads out. Hand-tune it afterwards.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ROUTE_IDS, layout as currentLayout, type LayoutFile, type RouteId, type StationsFile } from '@cb/shared';
import { mbtaGet } from '../apps/web/lib/mbta/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/shared/src/schematic');
for (const f of ['apps/web/.env.local', '.env.local']) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
const { values } = parseArgs({ options: { layout: { type: 'boolean', default: false } } });
const apiKey = process.env.MBTA_API_KEY || undefined;

type Rel = { data: { id: string; type: string } | null };
type Pattern = { id: string; attributes: { canonical: boolean; typicality: number; direction_id: 0 | 1; name: string }; relationships: { representative_trip: Rel; route: Rel } };
type Trip = { id: string; type: 'trip'; relationships: { stops?: { data: { id: string }[] } } };
type Stop = { id: string; type: 'stop'; attributes: { name: string; latitude: number; longitude: number }; relationships: { parent_station: Rel } };
type Res = { data: Pattern[]; included: (Trip | Stop)[] };

const stationsFile: StationsFile = { version: 1, generatedAt: new Date().toISOString(), routes: {} };
const coords = new Map<string, { name: string; lat: number; lon: number; n: number }>();
const paths: LayoutFile['paths'] = {};

for (const route of ROUTE_IDS) {
  const res = await mbtaGet<Res>(
    '/route_patterns',
    {
      'filter[route]': route,
      include: 'representative_trip.stops',
      'fields[stop]': 'name,latitude,longitude',
    },
    { apiKey },
  );
  const trips = new Map(res.included.filter((i): i is Trip => i.type === 'trip').map((t) => [t.id, t]));
  const stops = new Map(res.included.filter((i): i is Stop => i.type === 'stop').map((s) => [s.id, s]));
  const canonical = res.data.filter(
    (p) => p.attributes.typicality === 1 && p.relationships.route.data?.id === route,
  );
  const dirs: Record<'0' | '1', { id: string; name: string }[]> = { '0': [], '1': [] };

  for (const p of canonical.sort((a, b) => a.id.localeCompare(b.id))) {
    const trip = trips.get(p.relationships.representative_trip.data?.id ?? '');
    const seq: string[] = [];
    for (const { id } of trip?.relationships.stops?.data ?? []) {
      const stop = stops.get(id);
      if (!stop) continue;
      const parent = stop.relationships.parent_station.data?.id ?? stop.id;
      if (seq.at(-1) === parent) continue;
      seq.push(parent);
      const c = coords.get(parent) ?? { name: stop.attributes.name, lat: 0, lon: 0, n: 0 };
      c.lat += stop.attributes.latitude;
      c.lon += stop.attributes.longitude;
      c.n++;
      coords.set(parent, c);
    }
    const dir = String(p.attributes.direction_id) as '0' | '1';
    dirs[dir].push(...seq.map((id) => ({ id, name: coords.get(id)!.name })));
    if (dir === '0') (paths[route] ??= []).push(seq);
  }
  stationsFile.routes[route] = dirs;
  console.log(
    `${route.padEnd(8)} ${canonical.length} canonical patterns · dir0 ${dirs['0'].length} · dir1 ${dirs['1'].length} stations`,
  );
}

writeFileSync(join(OUT, 'stations.json'), JSON.stringify(stationsFile, null, 2) + '\n');
console.log(`wrote stations.json (${coords.size} parent stations)`);

const layoutEmpty = Object.keys(currentLayout.stations).length === 0;
if (values.layout || layoutEmpty) {
  // Equirectangular projection around Park Street, then a radial fisheye to open up downtown.
  const center = { lat: 42.35639, lon: -71.0624 };
  const kx = Math.cos((center.lat * Math.PI) / 180);
  const pts = [...coords].map(([id, c]) => {
    const x = (c.lon / c.n - center.lon) * kx;
    const y = -(c.lat / c.n - center.lat);
    return { id, x, y };
  });
  const rMax = Math.max(...pts.map((p) => Math.hypot(p.x, p.y)));
  const EXP = 0.42; // < 1 spreads the core, squeezes the ends
  const warped = pts.map((p) => {
    const r = Math.hypot(p.x, p.y);
    const s = r === 0 ? 0 : (Math.pow(r / rMax, EXP) * rMax) / r;
    return { id: p.id, x: p.x * s, y: p.y * s };
  });
  const W = 1600;
  const H = 1000;
  const M = 70;
  const minX = Math.min(...warped.map((p) => p.x));
  const maxX = Math.max(...warped.map((p) => p.x));
  const minY = Math.min(...warped.map((p) => p.y));
  const maxY = Math.max(...warped.map((p) => p.y));
  const scale = Math.min((W - 2 * M) / (maxX - minX), (H - 2 * M) / (maxY - minY));
  const offX = (W - (maxX - minX) * scale) / 2;
  const offY = (H - (maxY - minY) * scale) / 2;
  const layout: LayoutFile = { version: 1, width: W, height: H, stations: {}, paths };
  for (const p of warped) {
    layout.stations[p.id] = {
      x: Math.round(offX + (p.x - minX) * scale),
      y: Math.round(offY + (p.y - minY) * scale),
    };
  }
  writeFileSync(join(OUT, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');
  console.log(`wrote layout.json (${Object.keys(layout.stations).length} stations, generated)`);
} else {
  console.log('layout.json has hand-placed stations; left alone (pass --layout to regenerate)');
}
export type { RouteId };
