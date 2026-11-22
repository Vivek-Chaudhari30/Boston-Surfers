"use client";

import type { RaceView } from "./useRaceHost";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Compact Car Race status for the kiosk right rail. */
export function RaceRail({ race }: { race: RaceView }) {
  const { phase } = race;
  if (phase === "idle" && race.readyCount === 0) {
    return (
      <section className="kcar-race" aria-label="Car race">
        <h3>🏁 CAR RACE</h3>
        <p>Open the car QR on your phone and tap Car Race to join.</p>
      </section>
    );
  }
  if (phase === "running") {
    const top = Math.max(1, ...race.live.map((r) => r.score));
    return (
      <section className="kcar-race" aria-label="Car race live">
        <h3>🏁 RACE ON!</h3>
        <ol>
          {race.live.length === 0 && <li>Waiting for first scores…</li>}
          {race.live.slice(0, 4).map((r) => (
            <li key={r.riderId}>
              <span aria-hidden>{r.alive ? "" : "💥"}</span>
              <span className="n">{r.name}</span>
              <span className="bar">
                <i style={{ width: `${(r.score / top) * 100}%` }} />
              </span>
              <span className="s">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  if (phase === "results") {
    return (
      <section className="kcar-race" aria-label="Car race results">
        <h3>🏁 PODIUM</h3>
        <ol>
          {race.standings.length === 0 && <li>No finished runs.</li>}
          {race.standings.slice(0, 3).map((s, i) => (
            <li key={s.riderId}>
              <span>{MEDALS[i]}</span>
              <span className="n">{s.displayName}</span>
              <span className="s">{s.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  const secs = Math.ceil(race.msLeft / 1000);
  return (
    <section className="kcar-race" aria-label="Car race lobby">
      <h3>🏁 RACE STARTING</h3>
      {phase === "countdown" && <div className="kcar-big">{secs}</div>}
      <p>
        {race.readyCount} rider{race.readyCount === 1 ? "" : "s"} in: {race.readyNames.slice(0, 4).join(" · ")}
      </p>
      <p>Scan to join!</p>
    </section>
  );
}
