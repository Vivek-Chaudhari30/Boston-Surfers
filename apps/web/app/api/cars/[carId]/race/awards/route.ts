import { CarIdParams } from '@cb/shared';
import { grantRacePodium } from '@/lib/awards';
import { handle, parseBody, parseObject } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';
import { RaceQuery } from '@/lib/race';
import { raceStandings } from '@/lib/race-server';

/**
 * POST /api/cars/:carId/race/awards (kiosk) { since, riders } → { granted }.
 * The kiosk calls it once a race ends. Standings are recomputed here from finished runs;
 * awards are idempotent per (car, race start, rank).
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ carId: string }> }) => {
  const denied = requireKiosk(req);
  if (denied) return denied;
  const params = parseObject(await ctx.params, CarIdParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, RaceQuery);
  if (!body.ok) return body.response;
  const { carId } = params.data;
  const standings = await raceStandings(carId, body.data.since, body.data.riders);
  const granted = await grantRacePodium({ carId, startedAtIso: new Date(body.data.since).toISOString(), standings });
  return Response.json({ granted, standings });
});
