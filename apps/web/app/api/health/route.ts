import { db } from '@/lib/db';

/**
 * GET /api/health → which backends this deployment can reach. Never returns secrets.
 * Used by deploy checks and, later, the kiosk's hidden `D` status panel.
 */
export async function GET(_req: Request) {
  const checks: Record<string, 'ok' | 'missing' | 'error'> = {
    supabase: 'missing',
    mbtaKey: process.env.MBTA_API_KEY ? 'ok' : 'missing',
    sessionSecret: process.env.SESSION_SECRET ? 'ok' : 'missing',
    kioskSecret: process.env.KIOSK_SECRET ? 'ok' : 'missing',
  };
  try {
    const { error } = await db().from('cars').select('id', { head: true, count: 'exact' });
    checks.supabase = error ? 'error' : 'ok';
  } catch {
    checks.supabase = 'missing';
  }
  const ok = Object.values(checks).every((v) => v === 'ok');
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
