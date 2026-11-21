import { TransfersQuery } from '@cb/shared';
import { notImplemented, parseObject, queryObject } from '@/lib/http';

/** GET /api/transfers?vehicleId= → TransfersResponse. */
export async function GET(req: Request) {
  const query = parseObject(queryObject(req), TransfersQuery);
  if (!query.ok) return query.response;
  // TODO: getTransfers(vehicleId) from lib/mbta/transfers.
  return notImplemented();
}
