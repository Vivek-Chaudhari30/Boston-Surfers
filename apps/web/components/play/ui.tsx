import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      {children}
    </main>
  );
}

export function Brand({ sub }: { sub?: string }) {
  return (
    <header>
      <div className="mb-3 flex h-1 w-16 overflow-hidden rounded">
        <span className="flex-1 bg-mbta-red" />
        <span className="flex-1 bg-mbta-orange" />
        <span className="flex-1 bg-mbta-blue" />
        <span className="flex-1 bg-mbta-green" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Constant Buffers</h1>
      {sub && <p className="mt-1 text-hud-dim">{sub}</p>}
    </header>
  );
}

export function PrimaryButton({ className = '', style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl px-5 py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 ${className}`}
      style={{ background: props.color ?? 'var(--mbta-green)', ...style }}
    />
  );
}

export function GhostButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl border border-hud-border px-5 py-4 text-lg transition active:scale-[0.98] disabled:opacity-40 ${className}`}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-mbta-red/60 bg-mbta-red/10 px-4 py-3 text-sm">{children}</p>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-hud-border bg-hud-panel p-5">
      {title && <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-hud-dim">{title}</h2>}
      {children}
    </section>
  );
}
