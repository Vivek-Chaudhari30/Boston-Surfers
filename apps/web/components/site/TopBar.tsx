import Link from 'next/link';
import { LineBar } from '@/components/ui/Panel';

/** Slim site header: brand left, nav right, MBTA line stripe underneath. */
export function TopBar({ current }: { current?: 'map' | 'leaderboard' }) {
  const link = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] transition-colors hover:text-hud-text ${
      active ? 'bg-white/10 text-hud-text' : 'text-hud-dim'
    }`;
  return (
    <header className="z-30 shrink-0 bg-hud-bg/90 backdrop-blur">
      <div className="flex h-11 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
          <span className="h-2 w-2 rounded-full bg-mbta-green shadow-[0_0_10px_var(--mbta-green)]" />
          Constant Buffers
        </Link>
        <nav className="flex gap-1">
          <Link href="/" className={link(current === 'map')}>
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
