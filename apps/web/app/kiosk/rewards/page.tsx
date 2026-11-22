import { KioskHeader } from "@/components/kiosk/KioskHeader";
import { StationRewards } from "@/components/kiosk/StationRewards";
export default function KioskRewards() {
  return (
    <main className="kiosk-display rewards-display">
      <KioskHeader current="rewards" />
      <StationRewards />
    </main>
  );
}
