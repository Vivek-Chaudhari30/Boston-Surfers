// Server only. Official race standings from finished runs (never from broadcast payloads).
import { db } from './db';
import { podiumFromRuns, raceWindow, type RaceStanding } from './race';

export async function raceStandings(carId: string, since: string, riders: string[] | null): Promise<RaceStanding[]> {
  const win = raceWindow(since);
  let q = db()
    .from('runs')
    .select('rider_id,score')
    .eq('car_id', carId)
    .eq('status', 'finished')
    .gte('started_at', win.from)
    .lte('started_at', win.to);
  if (riders) q = q.in('rider_id', riders);
  const { data: runs, error } = await q;
  if (error) throw error;
  const rows = (runs ?? []) as { rider_id: string; score: number | null }[];
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.rider_id))];
  const { data: people, error: nameErr } = await db().from('riders').select('id,display_name').in('id', ids);
  if (nameErr) throw nameErr;
  const names = new Map((people ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
  return podiumFromRuns(rows, names, riders ? new Set(riders) : null);
}
