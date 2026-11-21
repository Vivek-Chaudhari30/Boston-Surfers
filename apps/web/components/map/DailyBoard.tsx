'use client';

import { DAILY_CHANNEL, DailyLeaderboardResponse, LINE_COLORS } from '@cb/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { subscribeChanged } from '@/lib/realtime';

/** Today's all-MBTA leaderboard. Polls every 30 s and refetches on `mbta:daily` hints. */
export function useDaily() {
  const [data, setData] = useState<DailyLeaderboardResponse | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api('/api/leaderboard/daily', DailyLeaderboardResponse));
    } catch {
      /* keep the last board */
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30_000);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeChanged(DAILY_CHANNEL, () => {
      clearTimeout(debounce);
      debounce = setTimeout(load, 300);
    });
    return () => {
      clearTimeout(first);
      clearInterval(t);
      clearTimeout(debounce);
      off();
    };
  }, [load]);
  return data;
}

export function DailyBoard({ limit = 10 }: { limit?: number }) {
  const data = useDaily();
  if (!data) return <p className="text-hud-dim">Loading…</p>;
  if (data.entries.length === 0) return <p className="text-hud-dim">No scores yet today. Hop on a train and play.</p>;
  return (
    <ol className="flex flex-col gap-1">
      {data.entries.slice(0, limit).map((e) => (
        <li key={e.rank} className="flex items-center gap-3 rounded-lg px-3 py-2 odd:bg-white/[0.03]">
          <span className="w-6 font-mono text-hud-dim">{e.rank}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[e.line] }} />
          <span className="flex-1 truncate">{e.displayName}</span>
          <span className="font-mono tabular-nums">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
