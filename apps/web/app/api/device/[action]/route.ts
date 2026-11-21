import { KIOSK_KEY_HEADER, isValidDispenseId } from '@cb/shared';
import { errorResponse, handle } from '@/lib/http';
import { requireKiosk } from '@/lib/kiosk-auth';

/**
 * Proxy to Jeet's UNO Q board server (firmware/unoq_web, see ARCHITECTURE §5.1).
 * The board is reachable only from the kiosk Mac (adb forward tcp:8765), so this works when the
 * kiosk runs on that Mac (`pnpm kiosk`), never on Vercel.
 *
 *   GET  /api/device/status  → board GET  /api/status
 *   POST /api/device/reward  → board POST /api/reward { id }
 *
 * Needs the kiosk key, except in `next dev` so local hardware testing needs no env vars.
 */
const BOARD_URL = () => process.env.UNOQ_URL || 'http://127.0.0.1:8765';
const BOARD_TIMEOUT_MS = 5000;

function authorize(req: Request): Response | null {
  if (process.env.NODE_ENV !== 'production' && !req.headers.get(KIOSK_KEY_HEADER)) return null;
  return requireKiosk(req);
}

async function forward(path: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${BOARD_URL()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(BOARD_TIMEOUT_MS),
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    return errorResponse(
      503,
      timedOut ? 'board did not answer in time' : 'board unreachable: is the adb forward and server.py running?',
      'DEVICE_UNREACHABLE',
    );
  }
}

export const GET = handle(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  const denied = authorize(req);
  if (denied) return denied;
  const { action } = await ctx.params;
  if (action !== 'status') return errorResponse(404, 'unknown device action', 'NOT_FOUND');
  return forward('/api/status', { method: 'GET' });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  const denied = authorize(req);
  if (denied) return denied;
  const { action } = await ctx.params;
  if (action !== 'reward') return errorResponse(404, 'unknown device action', 'NOT_FOUND');
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!isValidDispenseId(id)) return errorResponse(400, 'id must be 1-12 letters or digits', 'INVALID_INPUT');
  return forward('/api/reward', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
});
