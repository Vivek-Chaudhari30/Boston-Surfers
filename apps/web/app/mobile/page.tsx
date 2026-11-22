import { Suspense } from "react";
import { MobileHub } from "@/components/mobile/MobileHub";
export default function MobilePage() {
  return (
    <Suspense>
      <MobileHub section="play" />
    </Suspense>
  );
}
