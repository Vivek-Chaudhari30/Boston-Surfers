import Link from "next/link";
import { ArcadeBrand } from "@/components/play/ArcadeBrand";

export function KioskHeader({
  current,
}: {
  current: "map" | "rewards" | "claim";
}) {
  return (
    <header className="display-header">
      <ArcadeBrand href="/kiosk" />
      <span className="display-mode">BOSTON / PASSENGER KIOSK</span>
      <nav aria-label="Kiosk navigation">
        <Link
          href="/kiosk"
          aria-current={current === "map" ? "page" : undefined}
        >
          MAP + LEADERBOARD
        </Link>
        <Link
          href="/kiosk/rewards"
          aria-current={current === "rewards" ? "page" : undefined}
        >
          REWARDS ↗
        </Link>
        <Link
          href="/kiosk/claim"
          className="claim-header-link"
          aria-current={current === "claim" ? "page" : undefined}
        >
          CLAIM YOUR REWARD ◎
        </Link>
      </nav>
    </header>
  );
}
