import { Panel, Placeholder } from '@/components/ui/Panel';

/** Phone entry from the kiosk QR: /play?car=<carId>&t=<token>. Signup → join → lobby. */
export default function PlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Constant Buffers</h1>
      <Panel title="Sign up">
        <Placeholder>Name + phone: TODO</Placeholder>
      </Panel>
      <Panel title="Lobby">
        <Placeholder>Best score, rank, Play, I&apos;m getting off: TODO</Placeholder>
      </Panel>
    </main>
  );
}
