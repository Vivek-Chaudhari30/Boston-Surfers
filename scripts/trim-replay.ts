/**
 * Trim a raw replay recording into a small, git-friendly demo file.
 *
 *   pnpm tsx scripts/trim-replay.ts --in apps/web/public/replay/2026-11-21-1404.json \
 *     --out apps/web/public/replay/demo.json --minutes 30
 *
 * Keeps the first --minutes of frames (or --start <minutes> to skip ahead), keeps every
 * --step-th frame (default 2; intervalMs is scaled so playback speed stays the same), and
 * nulls fields nothing reads (tripId). prevStationId/progress stay: the kiosk re-places
 * every replay frame with placeSnapshot, but ReplayFile requires them.
 * The output is validated with the ReplayFile zod schema before it is written.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ReplayFile } from '@cb/shared';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_DIR = join(ROOT, 'apps/web/public/replay');

const { values } = parseArgs({
  options: {
    in: { type: 'string' },
    out: { type: 'string', default: join(REPLAY_DIR, 'demo.json') },
    minutes: { type: 'string', default: '30' },
    start: { type: 'string', default: '0' },
    step: { type: 'string', default: '2' },
  },
});

if (!values.in) {
  console.error('usage: trim-replay.ts --in <raw.json> [--out demo.json] [--minutes 30] [--start 0] [--step 2]');
  process.exit(1);
}

const inPath = resolve(values.in);
const outPath = resolve(values.out!);
const minutes = Number(values.minutes);
const startMin = Number(values.start);
const step = Math.max(1, Math.floor(Number(values.step)));
if (![minutes, startMin, step].every(Number.isFinite) || minutes <= 0) {
  console.error('--minutes, --start and --step must be numbers (minutes > 0)');
  process.exit(1);
}

const raw = ReplayFile.parse(JSON.parse(readFileSync(inPath, 'utf8')));
const windowFrames = Math.round((minutes * 60_000) / raw.intervalMs);
const startFrame = Math.round((startMin * 60_000) / raw.intervalMs);
const picked = raw.frames
  .slice(startFrame, startFrame + windowFrames)
  .filter((_, i) => i % step === 0)
  .map((f) => ({
    ...f,
    vehicles: f.vehicles.map((v) => ({ ...v, tripId: null })),
  }));

if (picked.length === 0) {
  console.error('no frames selected: check --start/--minutes against the recording');
  process.exit(1);
}

const out = ReplayFile.parse({
  version: 1,
  recordedAt: picked[0]!.fetchedAt,
  intervalMs: raw.intervalMs * step,
  frames: picked,
});
writeFileSync(outPath, JSON.stringify(out));

const counts = out.frames.map((f) => f.vehicles.length);
console.log(
  `${outPath}: ${(statSync(outPath).size / 1024).toFixed(0)} KB, ${out.frames.length} frames ` +
    `@ ${out.intervalMs / 1000}s = ${((out.frames.length * out.intervalMs) / 60_000).toFixed(1)} min, ` +
    `vehicles/frame ${Math.min(...counts)}..${Math.max(...counts)} (first ${counts[0]})`,
);
