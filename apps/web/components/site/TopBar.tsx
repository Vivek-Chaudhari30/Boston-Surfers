import Link from 'next/link';
import { LineBar } from '@/components/ui/Panel';
import { ArcadeBrand } from '@/components/play/ArcadeBrand';

/** Slim site header: brand left, nav right, MBTA line stripe underneath. */
export function TopBar({ current }: { current?: 'map' | 'leaderboard' }) {
  const link = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] transition-colors hover:text-hud-text ${
      active ? 'bg-white/10 text-hud-text' : 'text-hud-dim'
    }`;
  return (
    <header className="z-30 shrink-0 bg-hud-bg/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between bg-[#122448] px-4">
        <ArcadeBrand/>
        <nav className="flex gap-1">
          <Link href="/kiosk/rewards" className={link(false)}>Rewards</Link>
          <Link href="/kiosk" className={link(current === 'map')}>
            Map
          </Link>
          <Link href="/leaderboard" className={link(current === 'leaderboard')}>
            Leaderboard
          </Link>
        </nav>
      </div>
      <LineBar />
    </header>
  );
}
