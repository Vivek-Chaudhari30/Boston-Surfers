import { networkInterfaces } from 'node:os';
import { gameLink } from '@/lib/game-link';

/** Public play link only: no kiosk keys or rider tokens are included. */
export function GET(req: Request) {
  const interfaces = Object.entries(networkInterfaces()).sort(([a], [b]) =>
    Number(b === 'en0') - Number(a === 'en0'),
  );
  const lanAddress = interfaces.flatMap(([, addresses]) => addresses ?? []).find(
    (address) => address.family === 'IPv4' && !address.internal &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address),
  )?.address;
  // Next's request URL can contain the bind address (0.0.0.0); the Host header
  // retains the address the visitor actually opened, including the preview port.
  const origin = new URL(req.url);
  origin.host = req.headers.get('host') ?? origin.host;
  const link = gameLink(origin.origin, lanAddress);
  return Response.json(link ?? { error: 'Connect the kiosk to Wi-Fi to create a phone link.' }, {
    status: link ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
