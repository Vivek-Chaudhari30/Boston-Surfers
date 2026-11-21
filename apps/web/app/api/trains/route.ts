import { notImplemented } from '@/lib/http';

/** GET /api/trains → TrainSnapshot (server caches MBTA for 5 s). */
export async function GET(_req: Request) {
  // TODO: return Response.json(await getSnapshot()) from lib/mbta/snapshot.
  return notImplemented();
}
