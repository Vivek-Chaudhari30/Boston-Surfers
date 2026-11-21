/**
 * Build packages/shared/src/schematic/stations.json from the MBTA API (ARCHITECTURE §2.3).
 *
 *   pnpm tsx scripts/build-stations.ts
 *
 * TODO:
 * - For each ROUTE_ID: GET /route_patterns?filter[route]=<route>&include=representative_trip.stops
 * - Take the canonical (typicality 1) pattern per direction_id.
 * - Map each stop to its parent station (place-*), keep order, dedupe, keep names.
 * - Write StationsFile { version: 1, generatedAt, routes: { [route]: { '0': [...], '1': [...] } } }.
 * - Green B/C/D/E share trunk stations; layout.json is hand-placed separately.
 */
console.error('build-stations: not implemented yet (see TODO in scripts/build-stations.ts)');
process.exit(1);
