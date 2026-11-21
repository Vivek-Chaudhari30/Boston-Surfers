import { LINES, LINE_COLORS } from '@cb/shared';

/** MBTA line color legend. */
export function LineLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-hud-dim">
      {LINES.map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[l] }} />
          {l}
        </li>
      ))}
    </ul>
  );
}
