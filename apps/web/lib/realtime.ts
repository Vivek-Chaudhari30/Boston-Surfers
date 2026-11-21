/**
 * Supabase Realtime Broadcast (ARCHITECTURE §4 "Realtime").
 * Payloads are HINTS ONLY: subscribers must refetch from the API, never trust the payload.
 */
import type { ChangedPayload } from '@cb/shared';
import { REALTIME_EVENT } from '@cb/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server: send `{ event: 'changed', payload: { kind } }` over Realtime's REST endpoint
 * (no websocket subscribe). Best-effort: never throws into the caller.
 */
export async function broadcastChanged(channel: string, kind: ChangedPayload['kind']): Promise<void> {
  try {
    const { db } = await import('./db');
    const client = db();
    const ch = client.channel(channel);
    try {
      const res = await ch.httpSend(REALTIME_EVENT, { kind } satisfies ChangedPayload, { timeout: 3000 });
      if (!res.success) console.warn(`[realtime] ${channel} ${kind}: ${res.status} ${res.error}`);
    } finally {
      await client.removeChannel(ch);
    }
  } catch (err) {
    console.warn(`[realtime] ${channel} ${kind} failed`, err);
  }
}

let browserClient: SupabaseClient | null = null;

/**
 * Client: subscribe to `changed` events on a channel with the public key. Returns an unsubscribe fn.
 * Without Supabase env vars it is a no-op; 15 s polling covers it.
 */
export function subscribeChanged(channel: string, onChanged: () => void): () => void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return () => {};
  browserClient ??= createClient(url, anon, { auth: { persistSession: false } });
  const ch = browserClient.channel(channel).on('broadcast', { event: REALTIME_EVENT }, () => onChanged()).subscribe();
  return () => {
    void browserClient?.removeChannel(ch);
  };
}
