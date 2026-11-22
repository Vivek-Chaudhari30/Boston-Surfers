import { CarIdParams } from '@cb/shared';
import { handle, parseObject, queryObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { RaceQuery, type RaceResultsResponse } from '@/lib/race';
import { raceStandings } from '@/lib/race-server';

/** GET /api/cars/:carId/race?since=<ISO>&riders=<id,id> (kiosk) → { standings } (official podium). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const query = parseObject(queryObject(req), RaceQuery);
  if (!query.ok) return query.response;
  const standings = await raceStandings(params.data.carId, query.data.since, query.data.riders);
  return Response.json({ standings } satisfies RaceResultsResponse, { headers: { 'cache-control': 'no-store' } });
});
