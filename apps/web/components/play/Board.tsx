import type { Entry } from '@cb/shared';

export function Board({ entries, highlightRank }: { entries: Entry[]; highlightRank?: number | null }) {
  if (entries.length === 0) return <p className="text-hud-dim">No scores in this car yet. Be first.</p>;
  return (
    <ol className="flex flex-col gap-1">
      {entries.map((e) => (
        <li
          key={e.rank}
          className={`flex items-baseline gap-3 rounded-lg px-3 py-2 ${e.rank === highlightRank ? 'bg-mbta-green/20' : ''}`}
        >
          <span className="w-6 font-mono text-hud-dim">{e.rank}</span>
          <span className="flex-1 truncate">{e.displayName}</span>
          <span className="font-mono tabular-nums">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
