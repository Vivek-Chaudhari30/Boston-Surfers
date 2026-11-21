import { StartRunRequest } from '@cb/shared';
import { notImplemented, parseBody } from '@/lib/http';

/** POST /api/runs → StartRunResponse. */
export async function POST(req: Request) {
  const body = await parseBody(req, StartRunRequest);
  if (!body.ok) return body.response;
  // TODO: ride belongs to rider and is active; rateLimit('startRun'); insert run with random seed.
  return notImplemented();
}
