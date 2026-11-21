/**
 * Seed fake riders with beatable scores for the demo (ARCHITECTURE §8).
 *
 *   pnpm tsx scripts/seed-demo.ts
 *
 * TODO:
 * - Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * - Upsert ~5 riders (fake +1555… phones), an active ride each on green-3812,
 *   and finished runs with modest scores (e.g. 150–600) so a judge can win.
 * - Optionally add a few runs on other cars for the daily board (say they are seeded).
 * - Idempotent: safe to run before every rehearsal.
 */
console.error('seed-demo: not implemented yet (see TODO in scripts/seed-demo.ts)');
process.exit(1);
