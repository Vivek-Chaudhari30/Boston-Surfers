/**
 * URL flags that pick adapter implementations (ARCHITECTURE §2.2).
 *   ?dispenser=serial|http|mock   (http = Arduino UNO Q via /api/device, ARCHITECTURE §5.1)   ?input=webcam|keyboard   ?feed=live|replay
 */
export type AdapterFlags = {
  dispenser: 'serial' | 'http' | 'mock';
  input: 'webcam' | 'keyboard';
  feed: 'live' | 'replay';
};

export const DEFAULT_FLAGS: AdapterFlags = { dispenser: 'serial', input: 'webcam', feed: 'live' };

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Read flags from a URLSearchParams (or the current location when omitted, client only). */
export function readFlags(params?: URLSearchParams): AdapterFlags {
  const p = params ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams());
  return {
    dispenser: pick(p.get('dispenser'), ['serial', 'http', 'mock'] as const, DEFAULT_FLAGS.dispenser),
    input: pick(p.get('input'), ['webcam', 'keyboard'] as const, DEFAULT_FLAGS.input),
    feed: pick(p.get('feed'), ['live', 'replay'] as const, DEFAULT_FLAGS.feed),
  };
}
