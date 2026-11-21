import { isRouteId, layout, stations, type Point, type RouteId, type TrainVehicle } from '@cb/shared';

/** Station id → display name, from stations.json. */
export const STATION_NAMES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const dirs of Object.values(stations.routes)) {
    for (const d of ['0', '1'] as const) for (const s of dirs?.[d] ?? []) out[s.id] = s.name;
  }
  return out;
})();

export function stationName(id: string): string {
  return STATION_NAMES[id] ?? id.replace('place-', '');
}

/** Where a train is heading: the far end of the route in its direction (Red outbound has two branches). */
export function terminusName(route: string, directionId: 0 | 1): string | null {
  if (!isRouteId(route)) return null;
  if (route === 'Red' && directionId === 0) return 'Ashmont/Braintree';
  const list = stations.routes[route]?.[directionId === 0 ? '0' : '1'];
  const last = list?.at(-1);
  return last ? last.name : null;
}

/** Station ids at either end of a route (all branches). */
export function terminusIds(route: string): Set<string> {
  const out = new Set<string>();
  if (!isRouteId(route)) return out;
  const r = stations.routes[route];
  for (const d of ['0', '1'] as const) {
    const list = r?.[d] ?? [];
    if (list[0]) out.add(list[0].id);
    if (list.at(-1)) out.add(list.at(-1)!.id);
  }
  for (const p of layout.paths[route as RouteId] ?? []) {
    if (p[0]) out.add(p[0]);
    if (p.at(-1)) out.add(p.at(-1)!);
  }
  return out;
}

/** Moving = on its way to a station (not dwelling) and not at a terminus. */
export function isMoving(v: Pick<TrainVehicle, 'route' | 'status' | 'stationId'>): boolean {
  if (v.status === 'STOPPED_AT') return false;
  return !terminusIds(v.route).has(v.stationId);
}

export type PinEntry = { id: string; label: string; route: string; station: string; toward: string | null; moving: boolean };

/** Pin-list rows: station name + direction, sorted by route then station. */
export function pinEntries(vehicles: TrainVehicle[]): PinEntry[] {
  return vehicles
    .map((v) => ({
      id: v.id,
      label: v.label,
      route: v.route,
      station: stationName(v.stationId),
      toward: terminusName(v.route, v.directionId),
      moving: isMoving(v),
    }))
    .sort((a, b) => a.route.localeCompare(b.route) || a.station.localeCompare(b.station) || a.id.localeCompare(b.id));
}

/** Next station for a vehicle, derived from the snapshot only (replay mode has no predictions). */
export function nextStationFromVehicle(
  v: Pick<TrainVehicle, 'route' | 'directionId' | 'status' | 'stationId'>,
): { name: string; atStation: boolean; following: string | null } {
  const name = stationName(v.stationId);
  if (v.status !== 'STOPPED_AT') return { name, atStation: false, following: null };
  let following: string | null = null;
  if (isRouteId(v.route)) {
    const list = stations.routes[v.route]?.[v.directionId === 0 ? '0' : '1'] ?? [];
    const i = list.findIndex((s) => s.id === v.stationId);
    if (i >= 0 && list[i + 1]) following = list[i + 1].name;
  }
  return { name, atStation: true, following };
}

export type ViewBox = { x: number; y: number; w: number; h: number };

/** Bounding box of points plus per-side padding. Falls back to the full canvas when empty. */
export function computeViewBox(
  points: Point[],
  pad: { left: number; top: number; right: number; bottom: number },
  fallback: { width: number; height: number },
): ViewBox {
  if (points.length === 0) return { x: 0, y: 0, w: fallback.width, h: fallback.height };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad.left;
  const y = Math.min(...ys) - pad.top;
  return { x, y, w: Math.max(...xs) + pad.right - x, h: Math.max(...ys) + pad.bottom - y };
}

/** "3 riders" / "1 rider". */
export function ridersText(n: number): string {
  return `${n} rider${n === 1 ? '' : 's'}`;
}
