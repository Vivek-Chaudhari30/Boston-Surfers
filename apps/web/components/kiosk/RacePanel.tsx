'use client';

import type { RaceView } from './useRaceHost';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Car Race overlay for the kiosk map section (left 62%, so the join QR stays scannable). */
export function RacePanel({ race, color }: { race: RaceView; color: string }) {
  const { phase } = race;
  if (phase === 'idle' && race.readyCount === 0) return null;

  let body: React.ReactNode;
  if (phase === 'running') {
    const top = Math.max(1, ...race.live.map((r) => r.score));
    const secs = Math.floor(race.msElapsed / 1000);
    body = (
      <div className="w-full max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-5xl font-semibold">🏁 Race on!</h2>
          <span className="font-mono text-3xl tabular-nums text-hud-dim">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </span>
        </div>
        <ol className="mt-6 flex flex-col gap-3">
          {race.live.length === 0 && <li className="text-2xl text-hud-dim">Waiting for the first scores…</li>}
          {race.live.slice(0, 8).map((r) => (
            <li key={r.riderId} className="flex items-center gap-4 text-2xl">
              <span className="w-8 text-center">{r.alive ? '' : '💥'}</span>
              <span className="w-44 truncate">{r.name}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-hud-border">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${(r.score / top) * 100}%`, background: r.alive ? color : '#5a6480' }}
                />
              </div>
              <span className="w-24 text-right font-mono tabular-nums">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  } else if (phase === 'results') {
    body = (
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-5xl font-semibold">🏁 Race results</h2>
        {!race.official && <p className="mt-2 font-mono text-sm text-amber-400">unofficial: live order</p>}
        <ol className="mt-6 flex flex-col gap-3">
          {race.standings.length === 0 && <li className="text-2xl text-hud-dim">No finished runs.</li>}
          {race.standings.slice(0, 5).map((s, i) => (
            <li key={s.riderId} className="flex items-baseline gap-4 text-3xl">
              <span className="w-12">{MEDALS[i] ?? `${i + 1}`}</span>
              <span className="flex-1 truncate text-left">{s.displayName}</span>
              <span className="font-mono tabular-nums" style={{ color: i === 0 ? color : undefined }}>
                {s.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xl text-hud-dim">
          Race scores count on the car board: top the board when you get off to win a sticker.
        </p>
      </div>
    );
  } else {
    const secs = Math.ceil(race.msLeft / 1000);
    body = (
      <div className="text-center">
        <p className="font-mono text-xl uppercase tracking-[0.3em]" style={{ color }}>
          🏁 Car race
        </p>
        <p className="mt-2 text-[10rem] font-semibold leading-none tabular-nums">{phase === 'countdown' ? secs : '…'}</p>
        <p className="mt-4 text-3xl font-semibold">
          {race.readyCount} rider{race.readyCount === 1 ? '' : 's'} ready
        </p>
        <p className="mx-auto mt-2 max-w-2xl truncate text-2xl text-hud-dim">{race.readyNames.slice(0, 6).join(' · ')}</p>
        <p className="mt-6 text-2xl">Scan the QR and tap Car Race to join</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-4 z-20 grid place-items-center rounded-2xl border-2 bg-hud-bg/90 p-8 backdrop-blur" style={{ borderColor: color }}>
      {body}
    </div>
  );
}
