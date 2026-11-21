// Server only.
import { KIOSK_KEY_HEADER } from '@cb/shared';
import { serverEnv } from './env';
import { errorResponse } from './http';

/** Returns an error Response when the x-kiosk-key header is missing or wrong, else null. */
export function requireKiosk(req: Request): Response | null {
  const key = req.headers.get(KIOSK_KEY_HEADER);
  // TODO: constant-time compare.
  if (!key || key !== serverEnv().KIOSK_SECRET) return errorResponse(401, 'kiosk key required', 'UNAUTHORIZED');
  return null;
}
