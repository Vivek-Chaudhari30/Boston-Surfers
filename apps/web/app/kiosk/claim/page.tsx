import { Suspense } from "react";
import { KioskHeader } from "@/components/kiosk/KioskHeader";
import { RewardScanner } from "@/components/kiosk/RewardScanner";
export default function KioskClaimPage() {
  return (
    <main className="kiosk-display">
      <KioskHeader current="claim" />
      <Suspense fallback={<p>Opening reward scanner…</p>}>
        <RewardScanner />
      </Suspense>
    </main>
  );
}
