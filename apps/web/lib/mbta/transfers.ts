// Server only.
import { TRANSFER_STATIONS, isRouteId, lineOfRoute, type Line, type TransfersResponse } from '@cb/shared';
import { mbtaGet } from './client';
import { getSnapshot } from './snapshot';

/** Cache transfer answers per vehicle (ARCHITECTURE §2.5). */
export const TRANSFERS_CACHE_MS = 15_000;
/** Only suggest connections leaving at least this long after we arrive. */
export const MIN_TRANSFER_MIN = 2;

const ROUTES_BY_LINE: Record<Line, string[]> = {
  Red: ['Red'],
  Orange: ['Orange'],
  Blue: ['Blue'],
  Green: ['Green-B', 'Green-C', 'Green-D', 'Green-E'],
};

type Rel = { data: { id: string } | null } | undefined;
type Prediction = {
  attributes: { arrival_time: string | null; departure_time: string | null };
  relationships?: { stop?: Rel; route?: Rel };
};
type Stop = { id: string; type: string; attributes?: { name?: string }; relationships?: { parent_station?: Rel } };
type PredictionsRes = { data: Prediction[]; included?: Stop[] };

const cache = new Map<string, { at: number; value: TransfersResponse }>();
const minutesUntil = (iso: string, now: number) => Math.max(0, Math.round((Date.parse(iso) - now) / 60_000));

/** Transfer help for GET /api/transfers?vehicleId= (ARCHITECTURE §2.5). */
export async function getTransfers(vehicleId: string): Promise<TransfersResponse> {
  const hit = cache.get(vehicleId);
  if (hit && Date.now() - hit.at < TRANSFERS_CACHE_MS) return hit.value;

  const apiKey = process.env.MBTA_API_KEY || undefined;
  const now = Date.now();
  const vehicle = (await getSnapshot()).vehicles.find((v) => v.id === vehicleId);
  if (!vehicle?.tripId || !isRouteId(vehicle.route)) return { nextStops: [], suggestions: [] };
  const ourLine = lineOfRoute(vehicle.route);

  // 1. This train's upcoming stations and ETAs.
  const trip = await mbtaGet<PredictionsRes>(
    '/predictions',
    { 'filter[trip]': vehicle.tripId, include: 'stop', sort: 'stop_sequence' },
    { apiKey, signal: AbortSignal.timeout(6000) },
  );
  const stops = new Map((trip.included ?? []).filter((s) => s.type === 'stop').map((s) => [s.id, s]));
  const nextStops: TransfersResponse['nextStops'] = [];
  for (const p of trip.data) {
    const t = p.attributes.arrival_time ?? p.attributes.departure_time;
    const stopId = p.relationships?.stop?.data?.id;
    if (!t || !stopId || Date.parse(t) < now - 30_000) continue;
    const stop = stops.get(stopId);
    const stationId = stop?.relationships?.parent_station?.data?.id ?? stopId;
    if (nextStops.some((s) => s.stationId === stationId)) continue;
    nextStops.push({ stationId, name: stop?.attributes?.name ?? stationId, etaMin: minutesUntil(t, now) });
  }

  // 2–3. At upcoming transfer stations, the first other-line departure ≥ 2 min after we arrive.
  const suggestions: TransfersResponse['suggestions'] = [];
  const upcoming = nextStops
    .map((s) => ({ s, ts: TRANSFER_STATIONS.find((t) => t.stationId === s.stationId) }))
    .filter((x) => x.ts)
    .slice(0, 3);
  await Promise.all(
    upcoming.map(async ({ s, ts }) => {
      const otherRoutes = ts!.lines.filter((l) => l !== ourLine).flatMap((l) => ROUTES_BY_LINE[l]);
      if (!otherRoutes.length) return;
      const res = await mbtaGet<PredictionsRes>(
        '/predictions',
        { 'filter[stop]': s.stationId, 'filter[route]': otherRoutes.join(','), sort: 'departure_time' },
        { apiKey, signal: AbortSignal.timeout(6000) },
      );
      const earliest = now + (s.etaMin + MIN_TRANSFER_MIN) * 60_000;
      const next = res.data.find((p) => p.attributes.departure_time && Date.parse(p.attributes.departure_time) >= earliest);
      if (!next?.attributes.departure_time) return;
      suggestions.push({
        atStationId: s.stationId,
        atStationName: ts!.name,
        toRoute: next.relationships?.route?.data?.id ?? otherRoutes[0]!,
        departsInMin: minutesUntil(next.attributes.departure_time, now),
        ourEtaMin: s.etaMin,
      });
    }),
  );
  suggestions.sort((a, b) => a.ourEtaMin - b.ourEtaMin);

  const value: TransfersResponse = { nextStops: nextStops.slice(0, 8), suggestions };
  cache.set(vehicleId, { at: now, value });
  return value;
}
