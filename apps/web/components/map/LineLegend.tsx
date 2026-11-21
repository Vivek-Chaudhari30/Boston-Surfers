import { LINES, LINE_COLORS } from '@cb/shared';

/** MBTA line color legend. `chips` renders glassy pills for use over the map. */
export function LineLegend({ chips = false }: { chips?: boolean }) {
  return (
    <ul className={`flex flex-wrap font-mono text-xs text-hud-dim ${chips ? 'gap-1.5' : 'gap-x-4 gap-y-1'}`}>
      {LINES.map((l) => (
        <li
          key={l}
          className={`flex items-center gap-1.5 ${chips ? 'hud-glass rounded-full px-2.5 py-1 text-hud-text' : ''}`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: LINE_COLORS[l], boxShadow: `0 0 8px ${LINE_COLORS[l]}` }}
          />
          {l}
        </li>
      ))}
    </ul>
  );
}
