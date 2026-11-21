import { Suspense } from 'react';
import { LineBar, Panel, Placeholder } from '@/components/ui/Panel';

/**
 * Kiosk: /kiosk/<carId>?key=<KIOSK_SECRET>
 * Flags: ?feed=live|replay  ?dispenser=serial|mock  ?input=webcam|keyboard  ?vehicle=<id>
 * Layout (16:10): map left 62%, car panel right 38%, daily ticker at the bottom.
 */
export default function KioskPage({ params }: PageProps<'/kiosk/[carId]'>) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <LineBar />
      <div className="flex min-h-0 flex-1">
        <div className="w-[62%] p-4">
          <Panel title="Live map" className="h-full">
            <Placeholder>Spider-Tracker map + YOU: TODO</Placeholder>
          </Panel>
        </div>
        <div className="flex w-[38%] flex-col gap-4 p-4 pl-0">
          <Suspense fallback={<div className="h-10" />}>
            <CarHeader params={params} />
          </Suspense>
          <Panel title="Transfer">
            <Placeholder>Transfer card: TODO</Placeholder>
          </Panel>
          <Panel title="Car top 5" className="flex-1">
            <Placeholder>Car leaderboard: TODO</Placeholder>
          </Panel>
          <Panel title="Join">
            <Placeholder>Rotating join QR (30 s): TODO</Placeholder>
          </Panel>
        </div>
      </div>
      <footer className="border-t border-hud-border px-4 py-2 font-mono text-sm text-hud-dim">
        Daily ticker: TODO
      </footer>
    </main>
  );
}

async function CarHeader({ params }: { params: PageProps<'/kiosk/[carId]'>['params'] }) {
  const { carId } = await params;
  return <h1 className="text-4xl font-semibold tracking-tight">Car {carId}</h1>;
}
