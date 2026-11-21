import { describe, expect, it } from 'vitest';
import type { StationsFile, TrainSnapshot } from '@cb/shared';
import {
  parentStationMap,
  placeSnapshot,
  placeVehicle,
  previousStation,
  snapshotFromMbta,
  stationOrderFrom,
  vehiclePoint,
  type MbtaVehiclesResponse,
  type StationOrder,
} from './placement';

const order: StationOrder = {
  'Green-E': {
    0: ['place-mdftf', 'place-lech', 'place-north', 'place-haecl', 'place-gover', 'place-pktrm'],
    1: ['place-pktrm', 'place-gover', 'place-haecl', 'place-north', 'place-lech', 'place-mdftf'],
  },
};

describe('previousStation', () => {
  it('follows route + direction order', () => {
    expect(previousStation(order, 'Green-E', 0, 'place-gover')).toBe('place-haecl');
    expect(previousStation(order, 'Green-E', 1, 'place-gover')).toBe('place-pktrm');
  });
  it('is null at the first station, for unknown stations and unknown routes', () => {
    expect(previousStation(order, 'Green-E', 0, 'place-mdftf')).toBeNull();
    expect(previousStation(order, 'Green-E', 0, 'place-xxxx')).toBeNull();
    expect(previousStation(order, 'Red', 0, 'place-pktrm')).toBeNull();
    expect(previousStation(order, 'Silver', 0, 'place-pktrm')).toBeNull();
  });
});

describe('placeVehicle', () => {
  const base = { route: 'Green-E', directionId: 0 as const, stationId: 'place-gover' };
  it('maps status to progress', () => {
    expect(placeVehicle({ ...base, status: 'STOPPED_AT' }, order)).toEqual({ prevStationId: 'place-haecl', progress: 1 });
    expect(placeVehicle({ ...base, status: 'INCOMING_AT' }, order).progress).toBe(0.85);
    expect(placeVehicle({ ...base, status: 'IN_TRANSIT_TO' }, order).progress).toBe(0.5);
  });
  it('sits on the target when there is no previous station', () => {
    expect(placeVehicle({ ...base, stationId: 'place-mdftf', status: 'IN_TRANSIT_TO' }, order)).toEqual({
      prevStationId: null,
      progress: 1,
    });
  });
});

const mbta: MbtaVehiclesResponse = {
  data: [
    {
      id: 'G-10001',
      attributes: { current_status: 'IN_TRANSIT_TO', direction_id: 0, label: '3812-3706' },
      relationships: {
        route: { data: { id: 'Green-E' } },
        stop: { data: { id: '70202' } },
        trip: { data: { id: 'trip-1' } },
      },
    },
    {
      id: 'G-10002',
      attributes: { current_status: 'STOPPED_AT', direction_id: 1, label: null },
      relationships: { route: { data: { id: 'Green-E' } }, stop: { data: { id: 'place-pktrm' } }, trip: { data: null } },
    },
    // Dropped: no stop.
    {
      id: 'G-10003',
      attributes: { current_status: 'STOPPED_AT', direction_id: 0, label: 'x' },
      relationships: { route: { data: { id: 'Green-E' } }, stop: { data: null } },
    },
    // Dropped: unknown status.
    {
      id: 'G-10004',
      attributes: { current_status: 'WEIRD', direction_id: 0, label: 'x' },
      relationships: { route: { data: { id: 'Green-E' } }, stop: { data: { id: '70202' } } },
    },
  ],
  included: [
    { id: '70202', type: 'stop', relationships: { parent_station: { data: { id: 'place-gover', type: 'stop' } } } },
    { id: 'place-pktrm', type: 'stop', relationships: { parent_station: { data: null } } },
  ],
};

describe('MBTA → snapshot', () => {
  it('maps platforms to parent stations', () => {
    const m = parentStationMap(mbta.included);
    expect(m.get('70202')).toBe('place-gover');
    expect(m.get('place-pktrm')).toBe('place-pktrm');
  });

  it('builds vehicles and skips incomplete ones', () => {
    const snap = snapshotFromMbta(mbta, order, new Date('2026-11-21T18:00:00Z'));
    expect(snap.fetchedAt).toBe('2026-11-21T18:00:00.000Z');
    expect(snap.source).toBe('live');
    expect(snap.vehicles).toEqual([
      {
        id: 'G-10001',
        route: 'Green-E',
        directionId: 0,
        label: '3812-3706',
        tripId: 'trip-1',
        status: 'IN_TRANSIT_TO',
        stationId: 'place-gover',
        prevStationId: 'place-haecl',
        progress: 0.5,
      },
      {
        id: 'G-10002',
        route: 'Green-E',
        directionId: 1,
        label: 'G-10002',
        tripId: null,
        status: 'STOPPED_AT',
        stationId: 'place-pktrm',
        prevStationId: null,
        progress: 1,
      },
    ]);
  });

  it('re-places a snapshot recorded without a station order', () => {
    const recorded: TrainSnapshot = snapshotFromMbta(mbta, {}, new Date(), 'replay');
    expect(recorded.vehicles[0]?.prevStationId).toBeNull();
    const placed = placeSnapshot(recorded, order);
    expect(placed.vehicles[0]).toMatchObject({ prevStationId: 'place-haecl', progress: 0.5 });
  });
});

describe('stationOrderFrom', () => {
  it('reads stations.json shape', () => {
    const file: StationsFile = {
      version: 1,
      generatedAt: null,
      routes: { Red: { '0': [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], '1': [{ id: 'b', name: 'B' }] } },
    };
    expect(stationOrderFrom(file)).toEqual({ Red: { 0: ['a', 'b'], 1: ['b'] } });
  });
});

describe('vehiclePoint', () => {
  const layout = { stations: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } } };
  it('lerps and offsets perpendicular by direction', () => {
    expect(vehiclePoint({ stationId: 'b', prevStationId: 'a', progress: 0.5, directionId: 0 }, layout)).toEqual({ x: 50, y: 6 });
    expect(vehiclePoint({ stationId: 'b', prevStationId: 'a', progress: 0.5, directionId: 1 }, layout)).toEqual({ x: 50, y: -6 });
  });
  it('sits on the target without a previous station, and is null when not laid out', () => {
    expect(vehiclePoint({ stationId: 'b', prevStationId: null, progress: 1, directionId: 0 }, layout)).toEqual({ x: 100, y: 0 });
    expect(vehiclePoint({ stationId: 'zzz', prevStationId: 'a', progress: 1, directionId: 0 }, layout)).toBeNull();
  });
});
