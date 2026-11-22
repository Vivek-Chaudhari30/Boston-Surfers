/** A phone cannot reach the kiosk's localhost; use its LAN address for local previews. */
export function gameLink(origin: string, lanAddress?: string) {
  const url = new URL('/dev/game', origin);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid game origin');
  const loopback = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname);
  if (loopback) {
    if (!lanAddress) return null;
    url.hostname = lanAddress;
  }
  return { url: url.href, local: loopback || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) };
}
