import { notImplemented } from '@/lib/http';

/** GET /api/me → MeResponse. */
export async function GET(_req: Request) {
  // TODO: getRiderSession + active ride (ended_at null, < 90 min).
  return notImplemented();
}
