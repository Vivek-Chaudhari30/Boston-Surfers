import { TransfersQuery } from '@cb/shared';
import { errorResponse, handle, parseObject, queryObject } from '@/lib/http';
import { getTransfers } from '@/lib/mbta/transfers';

/** GET /api/transfers?vehicleId= → { nextStops, suggestions } (cached 15 s per vehicle). */
export const GET = handle(async (req: Request) => {
  const query = parseObject(queryObject(req), TransfersQuery);
  if (!query.ok) return query.response;
  try {
    return Response.json(await getTransfers(query.data.vehicleId), { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.warn('[transfers]', err);
    return errorResponse(502, 'MBTA unavailable', 'UPSTREAM');
  }
});
