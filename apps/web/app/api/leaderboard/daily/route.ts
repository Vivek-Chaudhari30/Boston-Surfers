import { DailyLeaderboardQuery } from '@cb/shared';
import { notImplemented, parseObject, queryObject } from '@/lib/http';

/** GET /api/leaderboard/daily?date=YYYY-MM-DD → DailyLeaderboardResponse (default: today, Boston time). */
export async function GET(req: Request) {
  const query = parseObject(queryObject(req), DailyLeaderboardQuery);
  if (!query.ok) return query.response;
  // TODO: daily_leaderboard view, sorted best_score desc.
  return notImplemented();
}
