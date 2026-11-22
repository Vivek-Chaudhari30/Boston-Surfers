import { Suspense } from "react";
import { KioskDisplay } from "@/components/kiosk/KioskDisplay";
import "../kiosk-car.css";

/**
 * In-car laptop screen. /kiosk?car=green-3812&key=<KIOSK_SECRET>
 * Flags: ?feed=live|replay  ?dispenser=serial|http|mock  ?vehicle=<id>  ?replay=<file>
 * Shift+D opens the hidden status panel. /kiosk/<carId> redirects here.
 */
export default function KioskPage() {
  return (
    <Suspense fallback={<main className="kiosk-display" />}>
      <KioskDisplay />
    </Suspense>
  );
}
