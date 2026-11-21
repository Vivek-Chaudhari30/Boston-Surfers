/**
 * Seed fake riders with beatable scores for the demo (ARCHITECTURE §8).
 *
 *   pnpm tsx scripts/seed-demo.ts            # (re)seed: clears old seed rows first, so it's safe to rerun
 *   pnpm tsx scripts/seed-demo.ts --clear    # remove seed rows only
 *   pnpm tsx scripts/seed-demo.ts --car green-3812
 *
 * Seed riders use fake +1555 01xx phone numbers so they can always be found and removed.
 * Rides expire after 90 minutes, so rerun it shortly before judging.
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['apps/web/.env.local', '.env.local']) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
const { values } = parseArgs({ options: { clear: { type: 'boolean', default: false }, car: { type: 'string', default: 'green-3812' } } });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Beatable but not trivial: a decent 30 s run beats the top seed. */
const SEEDS = [
  { phone: '+15550100001', name: 'TrolleyTina', score: 480 },
  { phone: '+15550100002', name: 'ParkStPete', score: 360 },
  { phone: '+15550100003', name: 'CharlieC', score: 250 },
  { phone: '+15550100004', name: 'Wonderland', score: 140 },
];

async function clear() {
  const { data: riders, error } = await db.from('riders').select('id').like('phone', '+155501000%');
  if (error) throw error;
  const ids = (riders ?? []).map((r) => r.id);
  if (!ids.length) return 0;
  for (const t of ['claims', 'runs', 'rides'] as const) {
    const { error: e } = await db.from(t).delete().in('rider_id', ids);
    if (e) throw e;
  }
  const { error: e } = await db.from('riders').delete().in('id', ids);
  if (e) throw e;
  return ids.length;
}

const removed = await clear();
console.log(`cleared ${removed} seed riders`);
if (values.clear) process.exit(0);

const { data: car, error: carErr } = await db.from('cars').select('id').eq('id', values.car).maybeSingle();
if (carErr) throw carErr;
if (!car) {
  console.error(`car ${values.car} does not exist`);
  process.exit(1);
}

const now = Date.now();
for (const [i, s] of SEEDS.entries()) {
  const { data: rider, error: rErr } = await db.from('riders').insert({ phone: s.phone, display_name: s.name }).select('id').single();
  if (rErr) throw rErr;
  const startedAt = new Date(now - (20 - i * 3) * 60_000).toISOString();
  const { data: ride, error: rideErr } = await db
    .from('rides')
    .insert({ rider_id: rider.id, car_id: values.car, started_at: startedAt })
    .select('id')
    .single();
  if (rideErr) throw rideErr;
  const durationMs = Math.round(((s.score / 20) + 5) * 1000); // a plausible pace, well under the cap
  const finishedAt = new Date(now - (10 - i) * 60_000).toISOString();
  const { error: runErr } = await db.from('runs').insert({
    ride_id: ride.id,
    rider_id: rider.id,
    car_id: values.car,
    seed: 1000 + i,
    started_at: new Date(Date.parse(finishedAt) - durationMs).toISOString(),
    finished_at: finishedAt,
    score: s.score,
    coins: Math.floor(s.score / 50),
    duration_ms: durationMs,
    status: 'finished',
  });
  if (runErr) throw runErr;
  console.log(`seeded ${s.name.padEnd(12)} ${String(s.score).padStart(4)} on ${values.car}`);
}
console.log('done. Rides expire in ~70 minutes; rerun before judging.');
