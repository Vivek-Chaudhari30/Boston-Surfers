import Link from "next/link";
import { LiveMap } from "@/components/map/LiveMap";
import { LineLegend } from "@/components/map/LineLegend";
import { LeadersCard } from "@/components/site/LeadersCard";
import { PlayQrCard } from "@/components/site/PlayQrCard";
import { KioskHeader } from "@/components/kiosk/KioskHeader";

/** Laptop display only. Game and passenger data live under /mobile. */
export default function KioskDisplay() {
  return (
    <main className="kiosk-display">
      <KioskHeader current="map" />
      <section className="display-map" aria-label="Boston live transit map">
        <LiveMap />
        <div className="display-intro comic-site-card">
          <p className="display-eyebrow">ISSUE 001 / BOSTON EDITION</p>
          <h1 className="comic-site-title">
            Your friendly
            <br />
            neighborhood T.
          </h1>
          <p>Track the city. Ride the lines. Become the local legend.</p>
          <Link href="/kiosk/rewards">DISCOVER LOCAL REWARDS ↗</Link>
        </div>
        <div className="display-legend">
          <LineLegend chips />
        </div>
        <aside
          className="display-rail"
          aria-label="Live leaderboard and passenger QR"
        >
          <LeadersCard />
          <PlayQrCard />
        </aside>
      </section>
    </main>
  );
}
