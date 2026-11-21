// Server only.
import { timingSafeEqual } from 'node:crypto';
import { KIOSK_KEY_HEADER } from '@cb/shared';
import { serverEnv } from './env';
import { errorResponse } from './http';

/** Returns an error Response when the x-kiosk-key header is missing or wrong, else null. */
export function requireKiosk(req: Request): Response | null {
  const given = Buffer.from(req.headers.get(KIOSK_KEY_HEADER) ?? '');
  const expected = Buffer.from(serverEnv().KIOSK_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return errorResponse(401, 'kiosk key required', 'UNAUTHORIZED');
  }
  return null;
}
