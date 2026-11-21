import { Suspense } from 'react';
import { PlayApp } from '@/components/play/PlayApp';

/** Phone entry from the kiosk QR: /play?car=<carId>&t=<token>. Sign up → join → lobby. */
export default function PlayPage() {
  return (
    <Suspense>
      <PlayApp />
    </Suspense>
  );
}
