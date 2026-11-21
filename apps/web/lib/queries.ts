// Server only. Typed reads over Supabase used by several routes.
import { RIDE_TTL_MS, type Car, type Entry, type Line } from '@cb/shared';
import { db } from './db';

export type CarRow = { id: string; line: Line; car_number: string; vehicle_id: string | null };
export type RideRowFull = { id: string; rider_id: string; car_id: string; started_at: string; ended_at: string | null };
export type BoardRow = { rider_id: string; display_name: string; best_score: number; first_at: string };

export function toCar(r: CarRow): Car {
  return { id: r.id, line: r.line, carNumber: r.car_number, vehicleId: r.vehicle_id };
}

export function rideCutoffIso(now = Date.now()): string {
  return new Date(now - RIDE_TTL_MS).toISOString();
}

export async function getCar(carId: string): Promise<CarRow | null> {
  const { data, error } = await db().from('cars').select('id,line,car_number,vehicle_id').eq('id', carId).maybeSingle();
  if (error) throw error;
  return data as CarRow | null;
}

export async function getRider(riderId: string): Promise<{ id: string; display_name: string } | null> {
  const { data, error } = await db().from('riders').select('id,display_name').eq('id', riderId).maybeSingle();
  if (error) throw error;
  return data;
}

/** The rider's current ride: not ended and younger than 90 minutes. */
export async function activeRideFor(riderId: string): Promise<RideRowFull | null> {
  const { data, error } = await db()
    .from('rides')
    .select('id,rider_id,car_id,started_at,ended_at')
    .eq('rider_id', riderId)
    .is('ended_at', null)
    .gt('started_at', rideCutoffIso())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RideRowFull | null;
}

/** Full car board, sorted best_score desc, first_at asc (ARCHITECTURE §3). */
export async function carBoard(carId: string): Promise<BoardRow[]> {
  const { data, error } = await db()
    .from('car_leaderboard')
    .select('rider_id,display_name,best_score,first_at')
    .eq('car_id', carId)
    .order('best_score', { ascending: false })
    .order('first_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export function toEntries(rows: BoardRow[], top = 5): Entry[] {
  return rows.slice(0, top).map((r, i) => ({ rank: i + 1, displayName: r.display_name, score: r.best_score }));
}

export async function activeRiderCount(carId: string): Promise<number> {
  const { count, error } = await db()
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .eq('car_id', carId)
    .is('ended_at', null)
    .gt('started_at', rideCutoffIso());
  if (error) throw error;
  return count ?? 0;
}

export async function pendingClaimFor(
  carId: string,
): Promise<{ displayName: string; score: number; expiresAt: string } | null> {
  const { data, error } = await db()
    .from('claims')
    .select('score,expires_at,riders(display_name)')
    .eq('car_id', carId)
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // supabase-js types embedded rows as arrays unless the FK is detected; handle both.
  const rider = (Array.isArray(data.riders) ? data.riders[0] : data.riders) as { display_name: string } | undefined;
  return { displayName: rider?.display_name ?? 'Rider', score: data.score, expiresAt: new Date(data.expires_at).toISOString() };
}
