import { FinishRunRequest, RunIdParams } from '@cb/shared';
import { notImplemented, parseBody, parseObject } from '@/lib/http';

/** POST /api/runs/:runId/finish → FinishRunResponse. Score validation per ARCHITECTURE §7. */
export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const params = parseObject(await ctx.params, RunIdParams);
  if (!params.ok) return params.response;
  const body = await parseBody(req, FinishRunRequest);
  if (!body.ok) return body.response;
  // TODO: validate against RUN_LIMITS / maxScoreForDuration; finish once; broadcast leaderboard + daily.
  return notImplemented();
}
