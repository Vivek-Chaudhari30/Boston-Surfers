import { describe, expect, it } from 'vitest';
import { buildGeoIndex, fitView, placeTrain, project, tileUrl, unproject, viewTransform, visibleTiles } from './geo';

describe('projection', () => {
  it('round-trips lon/lat', () => {
    const p = project(-71.0624, 42.3564, 14);
    const ll = unproject(p.x, p.y, 14);
    expect(ll.lon).toBeCloseTo(-71.0624, 6);
    expect(ll.lat).toBeCloseTo(42.3564, 6);
  });
  it('matches the known tile for Boston at z12', () => {
    const p = project(-71.0589, 42.3601, 12);
    expect([Math.floor(p.x / 256), Math.floor(p.y / 256)]).toEqual([1239, 1514]);
  });
});

describe('frame and tiles', () => {
  const bbox = [-71.25, 42.2, -70.99, 42.44] as const;
  it('fits the bbox inside the viewport', () => {
    const view = fitView(bbox, 800, 600, 20);
    const t = viewTransform(view, 800, 600);
    const a = project(bbox[0], bbox[3]);
    const b = project(bbox[2], bbox[1]);
    expect(a.x * t.scale + t.tx).toBeGreaterThanOrEqual(19);
    expect(b.x * t.scale + t.tx).toBeLessThanOrEqual(781);
    expect(a.y * t.scale + t.ty).toBeGreaterThanOrEqual(19);
    expect(b.y * t.scale + t.ty).toBeLessThanOrEqual(581);
  });
  it('lists only intersecting tiles, at an integer zoom', () => {
    const view = fitView(bbox, 800, 600, 20);
    const tiles = visibleTiles(view, 800, 600);
    expect(tiles.length).toBeGreaterThan(2);
    expect(tiles.length).toBeLessThan(40);
    expect(Number.isInteger(tiles[0]!.z)).toBe(true);
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length);
    expect(tileUrl(tiles[0]!)).toMatch(/^https:\/\/[a-d]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });
});

describe('placeTrain', () => {
  // An L-shaped track: A (0,0) east to B, then north to C.
  const geo = {
    stations: { A: { name: 'A', lon: -71.1, lat: 42.3 }, B: { name: 'B', lon: -71.0, lat: 42.3 }, C: { name: 'C', lon: -71.0, lat: 42.4 } },
    shapes: { Red: [[[-71.1, 42.3], [-71.0, 42.3], [-71.0, 42.4]] as [number, number][]] },
  };
  const g = buildGeoIndex(geo);
  const base = { route: 'Red', stationId: 'C', prevStationId: 'A', progress: 0.5, status: 'IN_TRANSIT_TO' as const };

  it('walks the shape, not the chord', () => {
    const p = placeTrain(base, g)!;
    // Half-way along A-B-C (arc length), which is near the corner B, not the chord midpoint.
    const chord = placeTrain({ ...base, route: 'Nope' }, g)!;
    expect(Math.abs(p.lon - -71.0)).toBeLessThan(0.03);
    expect(Math.abs(chord.lon - -71.05)).toBeLessThan(0.001);
    expect(p.lon).toBeGreaterThan(chord.lon);
  });
  it('heads along the track', () => {
    expect(placeTrain({ ...base, progress: 0.1 }, g)!.heading).toBeCloseTo(0, 0); // east
    expect(placeTrain({ ...base, progress: 0.9 }, g)!.heading).toBeCloseTo(-90, 0); // north
  });
  it('sits on the station when stopped or without a previous station', () => {
    const c = g.stations.C!;
    const stopped = placeTrain({ ...base, status: 'STOPPED_AT', progress: 1 }, g)!;
    expect(stopped.x).toBeCloseTo(c.x);
    const noPrev = placeTrain({ ...base, prevStationId: null }, g)!;
    expect(noPrev.y).toBeCloseTo(c.y);
    expect(noPrev.heading).toBeNull();
  });
  it('returns null for unknown stations', () => {
    expect(placeTrain({ ...base, stationId: 'ZZ' }, g)).toBeNull();
  });
});
