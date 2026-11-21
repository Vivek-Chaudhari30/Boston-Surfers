import { DispenserPanel } from './DispenserPanel';

/** Web Serial test panel for the Arduino dispenser. Chrome/Edge only. Needs no env vars. */
export default function DevDispenserPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-hud-dim">/dev/dispenser</h1>
      <DispenserPanel />
    </main>
  );
}
