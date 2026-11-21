"use client";

import {
  DAILY_CHANNEL,
  DailyLeaderboardResponse,
  LINE_COLORS,
} from "@cb/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { subscribeChanged } from "@/lib/realtime";

/** Today's all-MBTA leaderboard. Polls every 30 s and refetches on `mbta:daily` hints. */
export function useDaily(date?: string, onError?: (failed: boolean) => void) {
  const [res, setRes] = useState<{
    forDate: string | undefined;
    data: DailyLeaderboardResponse;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api(
          `/api/leaderboard/daily${date ? `?date=${date}` : ""}`,
          DailyLeaderboardResponse,
        );
        if (!cancelled) {
          setRes({ forDate: date, data });
          onError?.(false);
        }
      } catch {
        if (!cancelled) onError?.(true); // Keep the last board, but stop a first-load spinner.
      }
    };
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30_000);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeChanged(DAILY_CHANNEL, () => {
      clearTimeout(debounce);
      debounce = setTimeout(load, 300);
    });
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(t);
      clearTimeout(debounce);
      off();
    };
  }, [date, onError]);
  // Never show a board fetched for a different day than the one requested.
  return res && res.forDate === date ? res.data : null;
}

export function DailyBoard({
  limit = 10,
  date,
}: {
  limit?: number;
  date?: string;
}) {
  const [failed, setFailed] = useState(false);
  const data = useDaily(date, setFailed);
  if (!data || (date && data.date !== date))
    return (
      <p className="px-3 py-2 text-sm text-hud-dim">
        {failed
          ? "Standings are temporarily unavailable. We’ll retry automatically."
          : "Loading…"}
      </p>
    );
  if (data.entries.length === 0)
    return (
      <p className="px-3 py-2 text-sm text-hud-dim">
        {date
          ? "No scores on this day."
          : "No scores yet today. Hop on a train and play."}
      </p>
    );
  return (
    <ol className="flex flex-col gap-1">
      {data.entries.slice(0, limit).map((e) => (
        <li
          key={e.rank}
          className="flex items-center gap-3 rounded-lg px-3 py-2 odd:bg-white/[0.04] hover:bg-white/[0.07]"
        >
          <span
            className={`w-6 font-mono ${e.rank === 1 ? "text-mbta-orange" : "text-hud-dim"}`}
          >
            {e.rank}
          </span>
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: LINE_COLORS[e.line],
              boxShadow: `0 0 8px ${LINE_COLORS[e.line]}`,
            }}
          />
          <span className="flex-1 truncate">{e.displayName}</span>
          <span className="font-mono tabular-nums">
            {e.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
