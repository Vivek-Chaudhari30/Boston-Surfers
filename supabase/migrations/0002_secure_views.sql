-- Leaderboard views ran with their owner's rights (SECURITY DEFINER), bypassing RLS:
-- anyone with the public anon key could read rider ids, names and scores.
-- Run them with the caller's rights instead, and take them away from public roles entirely.
-- The server uses the service key, which bypasses RLS, so it is unaffected.
alter view car_leaderboard set (security_invoker = true);
alter view daily_leaderboard set (security_invoker = true);

revoke all on car_leaderboard, daily_leaderboard from anon, authenticated;
