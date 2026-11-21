// Server only: uses the Supabase service-role key. Never import from a client component.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. RLS is on with no policies, so only this client can read/write.
 * Created lazily so routes that don't touch the DB work without env vars.
 */
export function db(): SupabaseClient {
  if (client) return client;
  const env = serverEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// TODO: typed row helpers (riders, cars, rides, runs, claims; car_leaderboard, daily_leaderboard views).
