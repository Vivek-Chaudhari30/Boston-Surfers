import { Suspense } from "react";
import { MobileHub } from "@/components/mobile/MobileHub";
export default function Page() {
  return (
    <Suspense>
      <MobileHub section="history" />
    </Suspense>
  );
}
