import { DailyBoard } from "@/components/map/DailyBoard";

/** Compact "Today's leaders" card. Collapsible via <details> (open by default). */
export function LeadersCard() {
  return (
    <details open className="comic-site-card group">
      <summary className="comic-type flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xl uppercase text-yellow-100 [&::-webkit-details-marker]:hidden">
        Today&apos;s leaderboard
        <span
          aria-hidden
          className="transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="px-2 pb-3">
        <DailyBoard limit={5} />
      </div>
    </details>
  );
}
