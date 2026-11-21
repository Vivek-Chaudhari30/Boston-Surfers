/**
 * Record live MBTA snapshots for replay (ARCHITECTURE §2.1, §8).
 *
 *   pnpm tsx scripts/record-mbta.ts --minutes 60
 *   pnpm tsx scripts/record-mbta.ts --minutes 90 --interval 10 --out demo.json
 *
 * Writes apps/web/public/replay/<YYYY-MM-DD-HHmm>.json (ReplayFile v1), rewriting it after
 * every frame so Ctrl-C keeps everything recorded so far. Raw MBTA responses also go to
 * recordings/<name>.raw.jsonl (gitignored) in case placement logic changes later.
 * Use the kiosk with ?feed=replay&replay=<name>.json, or copy the file over demo.json.
 *
 * Needs MBTA_API_KEY (env, apps/web/.env.local or .env.local). Without a key MBTA allows
 * ~20 requests/min, which still covers one request every 10 s.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ReplayFile, stations, type TrainSnapshot } from '@cb/shared';
import { fetchVehicles } from '../apps/web/lib/mbta/client';
import { snapshotFromMbta, stationOrderFrom } from '../apps/web/lib/mbta/placement';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_DIR = join(ROOT, 'apps/web/public/replay');
const RAW_DIR = join(ROOT, 'recordings');

for (const f of ['apps/web/.env.local', '.env.local']) {
  const p = join(ROOT, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const { values } = parseArgs({
  options: {
    minutes: { type: 'string', default: '60' },
    interval: { type: 'string', default: '10' },
    out: { type: 'string' },
    raw: { type: 'boolean', default: true },
    'no-raw': { type: 'boolean', default: false },
  },
});

const minutes = Number(values.minutes);
const intervalMs = Math.round(Number(values.interval) * 1000);
if (!(minutes > 0) || !(intervalMs >= 2000)) {
  console.error('usage: --minutes <n > 0> [--interval <seconds ≥ 2>] [--out file.json] [--no-raw]');
  process.exit(1);
}

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const startedAt = new Date();
const name = values.out ?? `${stamp(startedAt)}.json`;
const outPath = join(REPLAY_DIR, name);
const rawPath = join(RAW_DIR, name.replace(/\.json$/, '') + '.raw.jsonl');
const keepRaw = values.raw && !values['no-raw'];
const apiKey = process.env.MBTA_API_KEY || undefined;
const order = stationOrderFrom(stations);

mkdirSync(REPLAY_DIR, { recursive: true });
if (keepRaw) mkdirSync(RAW_DIR, { recursive: true });

const frames: TrainSnapshot[] = [];
let failures = 0;

function save() {
  const file: ReplayFile = { version: 1, recordedAt: startedAt.toISOString(), intervalMs, frames };
  ReplayFile.parse(file); // never write a file the kiosk can't load
  const tmp = `${outPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(file));
  renameSync(tmp, outPath);
}

async function tick() {
  const now = new Date();
  try {
    const res = await fetchVehicles({ apiKey, signal: AbortSignal.timeout(8000) });
    if (keepRaw) appendFileSync(rawPath, JSON.stringify({ at: now.toISOString(), res }) + '\n');
    const snap = snapshotFromMbta(res, order, now, 'replay');
    frames.push(snap);
    save();
    failures = 0;
    const byRoute = new Map<string, number>();
    for (const v of snap.vehicles) byRoute.set(v.route, (byRoute.get(v.route) ?? 0) + 1);
    const summary = [...byRoute].map(([r, n]) => `${r}:${n}`).join(' ') || 'no vehicles (service paused?)';
    console.log(`[${now.toLocaleTimeString()}] frame ${frames.length}: ${snap.vehicles.length} vehicles  ${summary}`);
  } catch (err) {
    failures++;
    console.warn(`[${now.toLocaleTimeString()}] fetch failed (${failures} in a row): ${err instanceof Error ? err.message : err}`);
  }
}

console.log(
  `Recording ${minutes} min every ${intervalMs / 1000} s → ${outPath}` +
    (apiKey ? '' : '\n  (no MBTA_API_KEY: rate limited to ~20 req/min; get a key at https://api-v3.mbta.com)'),
);

const endAt = Date.now() + minutes * 60_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let stopping = false;

function finish(reason: string) {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  console.log(`\n${reason}. ${frames.length} frames saved to ${outPath}`);
  process.exit(0);
}

process.on('SIGINT', () => finish('Stopped'));
process.on('SIGTERM', () => finish('Stopped'));

async function loop() {
  const t0 = Date.now();
  await tick();
  if (Date.now() >= endAt) return finish('Done');
  timer = setTimeout(loop, Math.max(0, intervalMs - (Date.now() - t0)));
}

void loop();
