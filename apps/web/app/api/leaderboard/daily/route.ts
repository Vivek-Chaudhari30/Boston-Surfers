import { DailyLeaderboardQuery, type DailyLeaderboardResponse, type Line } from '@cb/shared';
import { db } from '@/lib/db';
import { handle, parseObject, queryObject } from '@/lib/http';
import { after } from 'next/server';
import { ensureDailyChampions } from '@/lib/awards';
import { bostonDate } from '@/lib/time';

/** GET /api/leaderboard/daily?date=YYYY-MM-DD → { date, entries } (default: today in Boston). */
export const GET = handle(async (req: Request) => {
  const query = parseObject(queryObject(req), DailyLeaderboardQuery);
  if (!query.ok) return query.response;
  const date = query.data.date ?? bostonDate();
  after(() => ensureDailyChampions());

  const { data, error } = await db()
    .from('daily_leaderboard')
    .select('display_name,best_score,line')
    .eq('day', date)
    .order('best_score', { ascending: false })
    .limit(20);
  if (error) throw error;

  const res: DailyLeaderboardResponse = {
    date,
    entries: (data ?? []).map((r, i) => ({
      rank: i + 1,
      displayName: r.display_name as string,
      score: r.best_score as number,
      line: r.line as Line,
    })),
  };
  return Response.json(res, { headers: { 'cache-control': 'no-store' } });
});
