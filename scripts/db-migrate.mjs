#!/usr/bin/env node
// Apply supabase/migrations/*.sql that are not yet recorded, using SUPABASE_DB_URL (apps/web/.env.local).
// Usage (no repo dependency on a pg driver): copy next to a node_modules with `postgres`, then CB_ROOT=<repo> node db-migrate.mjs [--status]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = process.env.CB_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'apps/web/.env.local');
const url =
  process.env.SUPABASE_DB_URL ??
  readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('SUPABASE_DB_URL='))?.slice('SUPABASE_DB_URL='.length).trim();
if (!url) {
  console.error('SUPABASE_DB_URL missing (env or apps/web/.env.local)');
  process.exit(1);
}
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });
try {
  await sql`create table if not exists _cb_migrations (name text primary key, applied_at timestamptz not null default now())`;
  // 0001/0002 were applied by hand from the dashboard before this script existed.
  const hasRiders = (await sql`select to_regclass('public.riders') as t`)[0].t;
  if (hasRiders) await sql`insert into _cb_migrations (name) values ('0001_init.sql'), ('0002_secure_views.sql') on conflict do nothing`;
  const done = new Set((await sql`select name from _cb_migrations`).map((r) => r.name));
  const dir = join(root, 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) { console.log(`✓ ${f}`); continue; }
    if (process.argv.includes('--status')) { console.log(`· ${f} (pending)`); continue; }
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, f), 'utf8'));
      await tx`insert into _cb_migrations (name) values (${f})`;
    });
    console.log(`+ ${f} applied`);
  }
} finally {
  await sql.end();
}
