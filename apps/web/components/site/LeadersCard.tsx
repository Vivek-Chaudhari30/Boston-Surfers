import { DailyBoard } from '@/components/map/DailyBoard';

/** Compact "Today's leaders" card. Collapsible via <details> (open by default). */
export function LeadersCard() {
  return (
    <details open className="hud-glass group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-hud-dim [&::-webkit-details-marker]:hidden">
        Today&apos;s leaders
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="px-2 pb-3">
        <DailyBoard limit={5} />
      </div>
    </details>
  );
}
