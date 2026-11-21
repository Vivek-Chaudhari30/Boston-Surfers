const STEPS = [
  { n: '1', t: 'Scan', d: 'Scan the QR on the kiosk in your train car.', c: 'var(--mbta-red)' },
  { n: '2', t: 'Play', d: 'Run the track on your phone. Beat your car.', c: 'var(--mbta-orange)' },
  { n: '3', t: 'Win a sticker', d: 'Top the car board, then tap I’m getting off to claim.', c: 'var(--mbta-green)' },
];

export function HowItWorks() {
  return (
    <section aria-label="How it works" className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.n} className="hud-glass relative overflow-hidden rounded-2xl p-5">
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: s.c, boxShadow: `0 0 12px ${s.c}` }} />
          <div className="flex items-center gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-full border font-mono text-sm"
              style={{ borderColor: s.c, color: s.c }}
            >
              {s.n}
            </span>
            <h3 className="font-mono text-sm uppercase tracking-[0.15em]">{s.t}</h3>
          </div>
          <p className="mt-3 text-sm text-hud-dim">{s.d}</p>
        </div>
      ))}
    </section>
  );
}
