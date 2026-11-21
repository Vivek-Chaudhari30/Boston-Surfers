import { connection } from 'next/server';
import { errorResponse, handle } from '@/lib/http';
import { getSnapshot } from '@/lib/mbta/snapshot';

/** GET /api/trains → TrainSnapshot (MBTA cached 5 s server-side). */
export const GET = handle(async (_req: Request) => {
  await connection();
  try {
    return Response.json(await getSnapshot(), { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.warn('[trains]', err);
    return errorResponse(502, 'MBTA unavailable', 'UPSTREAM');
  }
});
