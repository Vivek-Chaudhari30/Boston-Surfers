import type { ReactNode } from 'react';

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-hud-border bg-hud-panel/80 p-4 ${className}`}>
      {title && <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-hud-dim">{title}</h2>}
      {children}
    </section>
  );
}

export function LineBar() {
  return (
    <div className="flex h-1 w-full">
      <div className="flex-1 bg-mbta-red" />
      <div className="flex-1 bg-mbta-orange" />
      <div className="flex-1 bg-mbta-blue" />
      <div className="flex-1 bg-mbta-green" />
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full min-h-32 place-items-center rounded-lg border border-dashed border-hud-border font-mono text-sm text-hud-dim">
      {children}
    </div>
  );
}
