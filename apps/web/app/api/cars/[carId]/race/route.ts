import { CarIdParams } from '@cb/shared';
import { db } from '@/lib/db';
import { handle, parseObject, queryObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { RaceQuery, podiumFromRuns, raceWindow, type RaceResultsResponse } from '@/lib/race';

/** GET /api/cars/:carId/race?since=<ISO>&riders=<id,id> (kiosk) → { standings } (official podium). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const query = parseObject(queryObject(req), RaceQuery);
  if (!query.ok) return query.response;
  const { carId } = params.data;
  const { since, riders } = query.data;
  const win = raceWindow(since);

  let q = db()
    .from('runs')
    .select('rider_id,score')
    .eq('car_id', carId)
    .eq('status', 'finished')
    .gte('started_at', win.from)
    .lte('started_at', win.to);
  if (riders) q = q.in('rider_id', riders);
  const { data: runs, error } = await q;
  if (error) throw error;
  const rows = (runs ?? []) as { rider_id: string; score: number | null }[];
  if (!rows.length) return noStore({ standings: [] });

  const ids = [...new Set(rows.map((r) => r.rider_id))];
  const { data: people, error: nameErr } = await db().from('riders').select('id,display_name').in('id', ids);
  if (nameErr) throw nameErr;
  const names = new Map((people ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
  return noStore({ standings: podiumFromRuns(rows, names, riders ? new Set(riders) : null) });
});

function noStore(body: RaceResultsResponse): Response {
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
