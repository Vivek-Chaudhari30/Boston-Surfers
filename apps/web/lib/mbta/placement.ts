/**
 * Placing trains on the schematic (ARCHITECTURE §2.3). Pure functions, unit tested.
 *
 * - MBTA vehicle stops are usually platform ids; map them to parent stations via `included`.
 * - prev = the station before the target in that route + direction's order.
 * - progress: STOPPED_AT 1.0, INCOMING_AT 0.85, IN_TRANSIT_TO 0.5.
 * - Canvas point = lerp(prev, target, progress), offset ±6 px perpendicular by direction_id.
 */
import type { LayoutFile, Point, RouteId, StationsFile, TrainSnapshot, TrainStatus, TrainVehicle } from '@cb/shared';
import { isRouteId } from '@cb/shared';

export const PROGRESS: Record<TrainStatus, number> = {
  STOPPED_AT: 1,
  INCOMING_AT: 0.85,
  IN_TRANSIT_TO: 0.5,
};

export const DIRECTION_OFFSET_PX = 6;

/** Ordered parent-station ids per route and direction. Derived from stations.json. */
export type StationOrder = Partial<Record<RouteId, { 0: string[]; 1: string[] }>>;

export function stationOrderFrom(file: StationsFile): StationOrder {
  const order: StationOrder = {};
  for (const [route, dirs] of Object.entries(file.routes)) {
    if (!isRouteId(route) || !dirs) continue;
    order[route] = { 0: dirs['0'].map((s) => s.id), 1: dirs['1'].map((s) => s.id) };
  }
  return order;
}

/** The station before `stationId` on this route + direction, or null (terminal / unknown). */
export function previousStation(
  order: StationOrder,
  route: string,
  directionId: 0 | 1,
  stationId: string,
): string | null {
  if (!isRouteId(route)) return null;
  const list = order[route]?.[directionId];
  if (!list) return null;
  const i = list.indexOf(stationId);
  return i > 0 ? (list[i - 1] ?? null) : null;
}

export function placeVehicle(
  v: Pick<TrainVehicle, 'route' | 'directionId' | 'status' | 'stationId'>,
  order: StationOrder,
): Pick<TrainVehicle, 'prevStationId' | 'progress'> {
  const prevStationId = previousStation(order, v.route, v.directionId, v.stationId);
  // Without a previous station there is nothing to interpolate from: sit on the target.
  return { prevStationId, progress: prevStationId ? PROGRESS[v.status] : 1 };
}

/** Recompute prev/progress for every vehicle (e.g. replay frames recorded before stations.json existed). */
export function placeSnapshot(snap: TrainSnapshot, order: StationOrder): TrainSnapshot {
  return { ...snap, vehicles: snap.vehicles.map((v) => ({ ...v, ...placeVehicle(v, order) })) };
}

// ───────────── MBTA V3 JSON:API → TrainSnapshot ─────────────

type Rel = { data: { id: string; type?: string } | null } | undefined;

export type MbtaVehicleResource = {
  id: string;
  type?: string;
  attributes: {
    current_status: string;
    direction_id: number | null;
    label: string | null;
  };
  relationships?: { route?: Rel; stop?: Rel; trip?: Rel };
};

export type MbtaStopResource = {
  id: string;
  type: string;
  attributes?: { name?: string };
  relationships?: { parent_station?: Rel };
};

export type MbtaVehiclesResponse = {
  data: MbtaVehicleResource[];
  included?: MbtaStopResource[];
};

function isStatus(s: string): s is TrainStatus {
  return s === 'STOPPED_AT' || s === 'INCOMING_AT' || s === 'IN_TRANSIT_TO';
}

/** Platform/stop id → parent station id (falls back to the stop id itself). */
export function parentStationMap(included: MbtaStopResource[] = []): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of included) {
    if (r.type !== 'stop') continue;
    map.set(r.id, r.relationships?.parent_station?.data?.id ?? r.id);
  }
  return map;
}

/** Convert a `/vehicles?include=stop` response to vehicles. Skips vehicles missing route/stop/direction. */
export function vehiclesFromMbta(res: MbtaVehiclesResponse, order: StationOrder): TrainVehicle[] {
  const parents = parentStationMap(res.included);
  const out: TrainVehicle[] = [];
  for (const v of res.data) {
    const route = v.relationships?.route?.data?.id;
    const stopId = v.relationships?.stop?.data?.id;
    const dir = v.attributes.direction_id;
    const status = v.attributes.current_status;
    if (!route || !stopId || (dir !== 0 && dir !== 1) || !isStatus(status)) continue;
    const stationId = parents.get(stopId) ?? stopId;
    const base = { route, directionId: dir, status, stationId } as const;
    out.push({
      id: v.id,
      ...base,
      label: v.attributes.label ?? v.id,
      tripId: v.relationships?.trip?.data?.id ?? null,
      ...placeVehicle(base, order),
    });
  }
  return out;
}

export function snapshotFromMbta(
  res: MbtaVehiclesResponse,
  order: StationOrder,
  now: Date = new Date(),
  source: TrainSnapshot['source'] = 'live',
): TrainSnapshot {
  return { fetchedAt: now.toISOString(), source, vehicles: vehiclesFromMbta(res, order) };
}

// ───────────── Canvas position ─────────────

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Where to draw a vehicle on the layout canvas, or null if its station isn't laid out yet.
 * Offset perpendicular to the prev→target segment: +6 px for direction 0, −6 px for direction 1.
 */
export function vehiclePoint(
  v: Pick<TrainVehicle, 'stationId' | 'prevStationId' | 'progress' | 'directionId'>,
  layout: Pick<LayoutFile, 'stations'>,
): Point | null {
  const target = layout.stations[v.stationId];
  if (!target) return null;
  const prev = v.prevStationId ? layout.stations[v.prevStationId] : undefined;
  if (!prev) return { ...target };

  const p = lerp(prev, target, v.progress);
  const dx = target.x - prev.x;
  const dy = target.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return p;
  const sign = v.directionId === 0 ? 1 : -1;
  // Unit normal (rotate the segment 90° clockwise).
  const nx = -dy / len;
  const ny = dx / len;
  return { x: p.x + nx * DIRECTION_OFFSET_PX * sign, y: p.y + ny * DIRECTION_OFFSET_PX * sign };
}
