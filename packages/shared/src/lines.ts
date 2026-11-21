/** MBTA routes in scope (ARCHITECTURE §0): Red, Orange, Blue, Green B/C/D/E. */
export const ROUTE_IDS = ['Red', 'Orange', 'Blue', 'Green-B', 'Green-C', 'Green-D', 'Green-E'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

/** Line families, as stored in `cars.line`. */
export const LINES = ['Red', 'Orange', 'Blue', 'Green'] as const;
export type Line = (typeof LINES)[number];

/** Official MBTA line colors (ARCHITECTURE §2.6). */
export const LINE_COLORS: Record<Line, string> = {
  Red: '#DA291C',
  Orange: '#ED8B00',
  Blue: '#003DA5',
  Green: '#00843D',
};

/** Kiosk / map background. */
export const HUD_BACKGROUND = '#05070d';

export function isRouteId(value: string): value is RouteId {
  return (ROUTE_IDS as readonly string[]).includes(value);
}

/** 'Green-B' → 'Green', 'Red' → 'Red'. */
export function lineOfRoute(route: RouteId): Line {
  return route.startsWith('Green') ? 'Green' : (route as Exclude<RouteId, `Green-${string}`>);
}

export function routeColor(route: RouteId): string {
  return LINE_COLORS[lineOfRoute(route)];
}

export type TransferStation = {
  /** MBTA parent station id. */
  stationId: string;
  name: string;
  lines: readonly Line[];
};

/** Transfer stations used for transfer help (ARCHITECTURE §2.5). */
export const TRANSFER_STATIONS: readonly TransferStation[] = [
  { stationId: 'place-pktrm', name: 'Park Street', lines: ['Red', 'Green'] },
  { stationId: 'place-dwnxg', name: 'Downtown Crossing', lines: ['Red', 'Orange'] },
  { stationId: 'place-state', name: 'State', lines: ['Orange', 'Blue'] },
  { stationId: 'place-gover', name: 'Government Center', lines: ['Green', 'Blue'] },
  { stationId: 'place-haecl', name: 'Haymarket', lines: ['Orange', 'Green'] },
  { stationId: 'place-north', name: 'North Station', lines: ['Orange', 'Green'] },
] as const;

/** Car id format `<line>-<number>`, lowercase line, e.g. 'green-3812'. */
export const CAR_ID_PATTERN = /^(red|orange|blue|green)-[0-9]{1,6}$/;
