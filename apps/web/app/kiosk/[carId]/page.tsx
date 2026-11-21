import { Suspense } from 'react';
import { KioskApp } from '@/components/kiosk/KioskApp';

/**
 * Kiosk: /kiosk/<carId>?key=<KIOSK_SECRET>
 * Flags: ?feed=live|replay  ?dispenser=serial|mock  ?input=webcam|keyboard  ?vehicle=<id>  ?replay=<file>
 * Shift+D opens the hidden status panel.
 */
export default function KioskPage({ params }: PageProps<'/kiosk/[carId]'>) {
  return (
    <Suspense fallback={<main className="h-dvh bg-hud-bg" />}>
      <KioskLoader params={params} />
    </Suspense>
  );
}

async function KioskLoader({ params }: { params: PageProps<'/kiosk/[carId]'>['params'] }) {
  const { carId } = await params;
  return <KioskApp carId={carId} />;
}
