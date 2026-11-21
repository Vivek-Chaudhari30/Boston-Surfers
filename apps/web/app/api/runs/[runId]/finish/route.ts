import { DAILY_CHANNEL, FinishRunRequest, RIDE_TTL_MS, RunIdParams, carChannel, type FinishRunResponse } from '@cb/shared';
import { db } from '@/lib/db';
import { errorResponse, handle, parseBody, parseObject } from '@/lib/http';
import { carBoard, toEntries } from '@/lib/queries';
import { broadcastChanged } from '@/lib/realtime';
import { validateRun, type RideRow, type RunRow } from '@/lib/score';
import { getRiderSession } from '@/lib/session';

/** POST /api/runs/:runId/finish { score, coins, durationMs } → FinishRunResponse (ARCHITECTURE §7). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ runId: string }> }) => {
  const params = parseObject(await ctx.params, RunIdParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, FinishRunRequest);
  if (!body.ok) return body.response;
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'sign up first', 'NO_SESSION');

  const { data: run, error } = await db()
    .from('runs')
    .select('id,ride_id,rider_id,car_id,status,started_at')
    .eq('id', params.data.runId)
    .maybeSingle();
  if (error) throw error;
  if (!run) return errorResponse(404, 'run not found', 'NO_RUN');
  if (run.rider_id !== session.riderId) return errorResponse(403, 'not your run', 'NOT_OWNER');

  const { data: ride } = await db()
    .from('rides')
    .select('rider_id,ended_at,started_at')
    .eq('id', run.ride_id)
    .maybeSingle();

  const now = Date.now();
  const reason = validateRun({
    run: run as RunRow,
    ride: ride as RideRow | null,
    riderId: session.riderId,
    input: body.data,
    now,
    rideTtlMs: RIDE_TTL_MS,
  });

  let accepted = false;
  if (reason !== 'already_finished') {
    // Conditional on status = 'started' so a run can only be finished once, even under races.
    const { data: updated, error: upErr } = await db()
      .from('runs')
      .update({
        finished_at: new Date(now).toISOString(),
        score: body.data.score,
        coins: body.data.coins,
        duration_ms: body.data.durationMs,
        status: reason ? 'rejected' : 'finished',
        reject_reason: reason,
      })
      .eq('id', run.id)
      .eq('status', 'started')
      .select('id');
    if (upErr) throw upErr;
    accepted = !reason && (updated?.length ?? 0) === 1;
  }

  const [{ data: best }, board] = await Promise.all([
    db()
      .from('runs')
      .select('score')
      .eq('ride_id', run.ride_id)
      .eq('status', 'finished')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle(),
    carBoard(run.car_id),
  ]);
  const idx = board.findIndex((r) => r.rider_id === session.riderId);

  if (accepted) {
    void broadcastChanged(carChannel(run.car_id), 'leaderboard');
    void broadcastChanged(DAILY_CHANNEL, 'daily');
  }

  const res: FinishRunResponse = {
    accepted,
    ...(accepted ? {} : { reason: reason ?? 'already_finished' }),
    bestThisRide: best?.score ?? 0,
    carRank: idx >= 0 ? idx + 1 : null,
    carLeaderboard: toEntries(board),
  };
  return Response.json(res);
});
