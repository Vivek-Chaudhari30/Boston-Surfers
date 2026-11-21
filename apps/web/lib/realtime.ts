/**
 * Supabase Realtime Broadcast (ARCHITECTURE §4 "Realtime").
 * Payloads are HINTS ONLY: subscribers must refetch from the API, never trust the payload.
 */
import type { ChangedPayload } from '@cb/shared';

/**
 * Server: send `{ event: 'changed', payload: { kind } }` on `car:<carId>` or `mbta:daily`.
 * TODO: use supabase-js's REST broadcast path (channel.httpSend / send without subscribing —
 * check current supabase-js docs). Must never throw into the caller: realtime is best-effort.
 */
export async function broadcastChanged(_channel: string, _kind: ChangedPayload['kind']): Promise<void> {
  // TODO
}

/**
 * Client: subscribe to a channel with the anon key and call onChanged (debounce 300 ms upstream).
 * TODO: createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).channel(name)
 *   .on('broadcast', { event: 'changed' }, ...).subscribe(). Return an unsubscribe fn.
 * Returns a no-op unsubscribe until implemented; 15 s polling covers it.
 */
export function subscribeChanged(_channel: string, _onChanged: () => void): () => void {
  return () => {};
}
