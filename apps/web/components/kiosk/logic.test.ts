import { describe, expect, it } from 'vitest';
import type { TrainVehicle } from '@cb/shared';
import { computeViewBox, isMoving, nextStationFromVehicle, pinEntries, ridersText, stationName, terminusName } from './logic';

const v = (o: Partial<TrainVehicle>): TrainVehicle => ({
  id: 'x',
  route: 'Green-B',
  directionId: 0,
  label: '1',
  tripId: null,
  status: 'IN_TRANSIT_TO',
  stationId: 'place-pktrm',
  prevStationId: null,
  progress: 0.5,
  ...o,
});

describe('kiosk logic', () => {
  it('names stations and termini', () => {
    expect(stationName('place-pktrm')).toBe('Park Street');
    expect(stationName('place-unknown')).toBe('unknown');
    expect(terminusName('Green-B', 0)).toBe('Boston College');
    expect(terminusName('Red', 0)).toBe('Ashmont/Braintree');
    expect(terminusName('nope', 0)).toBeNull();
  });

  it('flags moving trains, not dwelling or terminus ones', () => {
    expect(isMoving(v({}))).toBe(true);
    expect(isMoving(v({ status: 'STOPPED_AT' }))).toBe(false);
    expect(isMoving(v({ stationId: 'place-lake' }))).toBe(false);
  });

  it('sorts pin entries by route then station', () => {
    const rows = pinEntries([v({ id: 'a', route: 'Green-C' }), v({ id: 'b', route: 'Green-B', stationId: 'place-gover' }), v({ id: 'c' })]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('derives next station from the snapshot', () => {
    expect(nextStationFromVehicle(v({})).atStation).toBe(false);
    const stopped = nextStationFromVehicle(v({ status: 'STOPPED_AT', stationId: 'place-gover' }));
    expect(stopped.atStation).toBe(true);
    expect(stopped.following).toBeTruthy();
  });

  it('computes a padded view box', () => {
    expect(computeViewBox([{ x: 10, y: 20 }, { x: 110, y: 70 }], { left: 5, top: 5, right: 20, bottom: 10 }, { width: 1, height: 1 })).toEqual({
      x: 5,
      y: 15,
      w: 125,
      h: 65,
    });
    expect(computeViewBox([], { left: 1, top: 1, right: 1, bottom: 1 }, { width: 8, height: 9 })).toEqual({ x: 0, y: 0, w: 8, h: 9 });
  });

  it('pluralises riders', () => {
    expect(ridersText(1)).toBe('1 rider');
    expect(ridersText(3)).toBe('3 riders');
  });
});
