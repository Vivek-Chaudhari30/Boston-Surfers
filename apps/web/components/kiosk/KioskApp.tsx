'use client';

import { CLAIM_CODE_LENGTH, LINE_COLORS, OkResponse, RedeemClaimResponse, lineOfRoute, isRouteId, type Line, type TrainVehicle } from '@cb/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpDispenser, createDispenser, WebSerialDispenser, type Dispenser, type DispenserStatus } from '@/lib/adapters/dispenser';
import { readFlags } from '@/lib/adapters/flags';
import { createRiderInputs, type RiderInput } from '@/lib/adapters/rider-input';
import { api, errorText } from '@/lib/api-client';
import { GeoMap } from '@/components/map/GeoMap';
import { useDaily } from '@/components/map/DailyBoard';
import { useTrains } from '@/components/map/useTrains';
import { useCarState, useJoinToken, useKioskKey, useMissingFor, useToast, useTransfers, useWindowCountdown } from './hooks';
import { nextStationFromVehicle, ridersText, stationName } from './logic';
import { DevPanel } from './DevPanel';
import { RacePanel } from './RacePanel';
import { useRaceHost } from './useRaceHost';

type Phase =
  | { kind: 'idle' }
  | { kind: 'redeeming' }
  | { kind: 'dispensing'; name: string }
  | { kind: 'done'; name: string; ok: boolean; lightOnly: boolean };

const REDEEM_TEXT: Record<string, string> = {
  invalid: 'That code isn’t valid',
  expired: 'That code expired',
  wrong_car: 'That code is for another car',
  used: 'That code was already used',
};

/** The in-car kiosk: /kiosk/<carId>?key=…&feed=…&dispenser=…&input=…&vehicle=… */
export function KioskApp({ carId }: { carId: string }) {
  const params = useSearchParams();
  const flags = useMemo(() => readFlags(new URLSearchParams(params.toString())), [params]);
  const kioskKey = useKioskKey(params.get('key'));

  const [riderToast, showRiderToast] = useToast(3000);
  const onRiderAboard = useCallback((n: number) => showRiderToast(`🚋 New rider aboard · ${ridersText(n)}`), [showRiderToast]);
  const { state, error: stateError, reload, realtimeHits } = useCarState(carId, kioskKey, onRiderAboard);
  const race = useRaceHost(carId, kioskKey, reload);
  const { token, error: tokenError } = useJoinToken(carId, kioskKey);
  const trains = useTrains({ feed: flags.feed, replayFile: params.get('replay') ?? undefined });
  const daily = useDaily();
  const youVehicleId = params.get('vehicle') ?? state?.car.vehicleId ?? null;
  const transfers = useTransfers(trains.mode === 'live' ? youVehicleId : null);
  const youTrain = trains.snapshot?.vehicles.find((v) => v.id === youVehicleId);
  const pinnedMissing = useMissingFor(youVehicleId, trains.mode === 'replay' || !trains.snapshot || !!youTrain);
  const line: Line = state?.car.line ?? 'Green';
  const color = LINE_COLORS[line];

  // ── Dispenser ──
  const [dispenser] = useState<Dispenser>(() => createDispenser(flags, { kioskKey: params.get('key') }));
  const [dispStatus, setDispStatus] = useState<DispenserStatus>('disconnected');
  useEffect(() => {
    const off = dispenser.onStatus((s) => setDispStatus(s));
    if (dispenser instanceof WebSerialDispenser) void dispenser.autoConnect();
    else dispenser.connect().catch(() => undefined); // status listener shows the error
    return () => {
      off();
      void dispenser.disconnect();
    };
  }, [dispenser]);

  // ── Claim → redeem → dispense ──
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [toast, showToast] = useToast();
  const [typed, setTyped] = useState('');
  const [codeBad, setCodeBad] = useState(false);
  const badTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashBad = useCallback(() => {
    setCodeBad(true);
    clearTimeout(badTimer.current);
    badTimer.current = setTimeout(() => setCodeBad(false), 900);
  }, []);
  useEffect(() => () => clearTimeout(badTimer.current), []);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const onCode = useCallback(
    async (code: string) => {
      if (!kioskKey || phaseRef.current.kind !== 'idle') return;
      setPhase({ kind: 'redeeming' });
      try {
        const r = await api('/api/claims/redeem', RedeemClaimResponse, { body: { code, carId }, kioskKey });
        if (!r.ok) {
          showToast(REDEEM_TEXT[r.reason] ?? 'Code not accepted');
          flashBad();
          setPhase({ kind: 'idle' });
          return;
        }
        setPhase({ kind: 'dispensing', name: r.displayName });
        const result =
          dispenser.status() === 'ready'
            ? await dispenser.dispense(r.dispenseId)
            : ({ ok: false, error: `dispenser ${dispenser.status()}` } as const);
        await api(`/api/claims/${code}/dispensed`, OkResponse, {
          body: result.ok ? { status: 'done' } : { status: 'error', detail: result.error.slice(0, 200) },
          kioskKey,
        }).catch(() => undefined);
        const lightOnly = result.ok && dispenser instanceof HttpDispenser && dispenser.lastMode === 'led-only';
        setPhase({ kind: 'done', name: r.displayName, ok: result.ok, lightOnly });
        setTimeout(() => setPhase({ kind: 'idle' }), 7000);
        void reload();
      } catch (err) {
        showToast(errorText(err));
        flashBad();
        setPhase({ kind: 'idle' });
      }
    },
    [carId, dispenser, flashBad, kioskKey, reload, showToast],
  );

  // ── Rider input: keyboard always; webcam only while a winner is waiting ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasPending = !!state?.pendingClaim;
  const waitingForClaim = hasPending && phase.kind === 'idle';
  const [camError, setCamError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh scanner starts in the "starting" state
    setCamReady(false);
    setCamError(null);
    const inputs: RiderInput[] = createRiderInputs(hasPending ? videoRef.current : null, flags, {
      onBuffer: setTyped,
      onCamReady: () => setCamReady(true),
      onCamError: (m) => setCamError(m),
    });
    const cb = (code: string) => void onCode(code);
    for (const input of inputs) input.start(cb).catch(() => undefined);
    return () => inputs.forEach((i) => i.stop());
  }, [hasPending, flags, onCode]);

  // ── Hidden status panel: press D ──
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.key === 'd' || e.key === 'D') && e.shiftKey) setPanel((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!kioskKey) {
    return (
      <main className="grid h-dvh place-items-center p-8 text-center">
        <div>
          <h1 className="text-3xl font-semibold">Kiosk key missing</h1>
          <p className="mt-3 text-hud-dim">Open this page as /kiosk/{carId}?key=&lt;KIOSK_SECRET&gt; once.</p>
        </div>
      </main>
    );
  }

  const lineVehicles = (trains.snapshot?.vehicles ?? []).filter((v) => isRouteId(v.route) && lineOfRoute(v.route) === line);

  return (
    <main className="flex h-dvh select-none flex-col overflow-hidden bg-hud-bg">
      <div className="flex h-1.5">
        <span className="flex-1" style={{ background: color }} />
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Map: left 62% */}
        <section className="relative w-[62%] p-4">
          <GeoMap snapshot={trains.snapshot} youVehicleId={youVehicleId} variant="kiosk" />
          <div className="absolute left-6 top-6 font-mono text-sm text-hud-dim">
            {trains.mode === 'replay' ? 'REPLAY' : 'LIVE'} · {trains.snapshot?.vehicles.length ?? 0} trains
            {youTrain ? '' : youVehicleId ? ' · your train not in feed' : ' · press Shift+D to pin your train'}
          </div>
          <RacePanel race={race} color={color} />
        </section>

        {/* Car panel: right 38% */}
        <section className="flex w-[38%] min-w-0 flex-col gap-4 p-4 pl-0">
          <header>
            <p className="font-mono text-sm uppercase tracking-[0.25em]" style={{ color }}>
              {line} Line
            </p>
            <h1 className="text-5xl font-semibold tracking-tight">Car {state?.car.carNumber ?? carId.split('-')[1]}</h1>
            <p className="mt-1 text-lg text-hud-dim">
              {state ? `${state.activeRiders} rider${state.activeRiders === 1 ? '' : 's'} aboard` : stateError ?? 'Connecting…'}
            </p>
          </header>

          <TransferCard data={transfers} pinned={!!youVehicleId} vehicle={youTrain} replay={trains.mode === 'replay'} missing={pinnedMissing} />

          <div className="min-h-0 flex-1 rounded-2xl border border-hud-border bg-hud-panel p-5">
            <h2 className="mb-3 font-mono text-sm uppercase tracking-[0.2em] text-hud-dim">This car · top 5</h2>
            {state?.leaderboard.length ? (
              <ol className="flex flex-col gap-2">
                {state.leaderboard.map((e) => (
                  <li key={e.rank} className="flex items-baseline gap-4 text-2xl">
                    <span className="w-8 font-mono text-hud-dim">{e.rank}</span>
                    <span className="flex-1 truncate">{e.displayName}</span>
                    <span className="font-mono tabular-nums">{e.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xl text-hud-dim">No scores yet. Scan to play and top the board!</p>
            )}
          </div>

          <JoinQr url={token?.url ?? null} error={tokenError} color={color} />
        </section>
      </div>

      <Ticker entries={daily?.entries ?? []} />

      {(waitingForClaim || phase.kind !== 'idle') && (
        <WinnerOverlay
          phase={phase}
          pending={state?.pendingClaim ?? null}
          color={color}
          videoRef={videoRef}
          camEnabled={flags.input === 'webcam'}
          camError={flags.input === 'webcam' ? camError : null}
          camReady={camReady}
          typed={typed}
          codeBad={codeBad}
        />
      )}
      <DispenserChip status={dispStatus} kind={dispenser.kind} />
      {riderToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-10 z-50 -translate-x-1/2 rounded-xl border-2 bg-hud-panel px-8 py-4 text-3xl font-semibold shadow-2xl"
          style={{ borderColor: color, color }}
        >
          {riderToast}
        </div>
      )}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-xl border border-mbta-red bg-hud-panel px-6 py-4 text-2xl shadow-2xl">
          {toast}
        </div>
      )}
      {panel && (
        <DevPanel
          carId={carId}
          kioskKey={kioskKey}
          flags={flags}
          feedMode={trains.mode}
          setFeedMode={trains.setMode}
          feedError={trains.error}
          dispenser={dispenser}
          dispenserStatus={dispStatus}
          realtimeHits={realtimeHits}
          youVehicleId={youVehicleId}
          lineVehicles={lineVehicles}
          onPinned={reload}
          onClose={() => setPanel(false)}
          onTestCode={onCode}
        />
      )}
    </main>
  );
}

function TransferCard({
  data,
  pinned,
  vehicle,
  replay,
  missing,
}: {
  data: ReturnType<typeof useTransfers>;
  pinned: boolean;
  vehicle: TrainVehicle | undefined;
  replay: boolean;
  missing: boolean;
}) {
  const next = data?.nextStops[0];
  const s = data?.suggestions[0];
  const dim = 'text-xl text-hud-dim';
  let body: React.ReactNode;
  if (next) {
    body = (
      <>
        <p className="text-3xl">
          {next.name} <span className="text-hud-dim">· {next.etaMin <= 0 ? 'now' : `${next.etaMin} min`}</span>
        </p>
        {s ? (
          <p className="mt-2 text-xl">
            Transfer at {s.atStationName} ({s.ourEtaMin} min): next <span className="font-semibold">{s.toRoute.replace('-', ' ')}</span>{' '}
            leaves {s.departsInMin - s.ourEtaMin} min after you arrive.
          </p>
        ) : (
          <p className="mt-2 text-lg text-hud-dim">No transfers coming up on this trip.</p>
        )}
      </>
    );
  } else if (!pinned) {
    body = <p className={dim}>Transfer help appears once your train is pinned.</p>;
  } else if (!vehicle) {
    body = <p className={dim}>Your train isn’t in the feed right now.</p>;
  } else if (replay) {
    const n = nextStationFromVehicle(vehicle);
    body = n.atStation ? (
      <>
        <p className="text-3xl">At {n.name}</p>
        {n.following && <p className="mt-2 text-xl text-hud-dim">Next: {n.following}</p>}
      </>
    ) : (
      <p className="text-3xl">{n.name}</p>
    );
  } else if (!data) {
    body = <p className={dim}>Loading predictions…</p>;
  } else if (vehicle.status === 'STOPPED_AT') {
    body = (
      <>
        <p className="text-3xl">{stationName(vehicle.stationId)}</p>
        <p className="mt-2 text-xl text-hud-dim">Your train is waiting to depart: next trip starts soon.</p>
      </>
    );
  } else {
    // Moving but no predictions (usually the last stretch of a trip): show where it's heading.
    body = (
      <>
        <p className="text-3xl">{stationName(vehicle.stationId)}</p>
        <p className="mt-2 text-xl text-hud-dim">Arriving soon. No transfer predictions for this stretch.</p>
      </>
    );
  }
  return (
    <div className="rounded-2xl border border-hud-border bg-hud-panel p-5">
      <h2 className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-hud-dim">Next stop</h2>
      {body}
      {missing && (
        <p className="mt-3 inline-block rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-sm text-amber-400">
          Pinned train left service: press Shift+D to re-pin
        </p>
      )}
    </div>
  );
}

function DispenserChip({ status, kind }: { status: DispenserStatus; kind: string }) {
  const ok = status === 'ready' || status === 'busy';
  return (
    <div
      className={`pointer-events-none fixed bottom-14 right-3 z-30 rounded-full border border-hud-border bg-hud-bg/70 px-3 py-1 font-mono text-xs ${ok ? 'text-hud-dim' : 'text-amber-400'}`}
    >
      dispenser: {ok ? 'ready' : 'offline'} ({kind})
    </div>
  );
}

function JoinQr({ url, error, color }: { url: string | null; error: string | null; color: string }) {
  const left = useWindowCountdown();
  const C = 2 * Math.PI * 22;
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-hud-border bg-hud-panel p-5">
      <div className="shrink-0 rounded-xl bg-white p-3">
        {url ? <QRCodeSVG value={url} size={176} level="M" marginSize={0} /> : <div className="size-[176px] bg-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-semibold leading-tight">Scan to play</p>
        <p className="mt-1 text-lg text-hud-dim">Top this car&apos;s board when you get off and win a sticker.</p>
        <div className="mt-3 flex items-center gap-2 font-mono text-sm text-hud-dim">
          <svg width="28" height="28" viewBox="0 0 50 50" className="-rotate-90">
            <circle cx="25" cy="25" r="22" fill="none" stroke="#1c2540" strokeWidth="5" />
            <circle
              cx="25"
              cy="25"
              r="22"
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - left / 30)}
              style={{ transition: 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
          {error ? <span className="text-mbta-red">{error}</span> : <span>new code in {left}s</span>}
        </div>
      </div>
    </div>
  );
}

function Ticker({ entries }: { entries: { rank: number; displayName: string; score: number; line: Line }[] }) {
  const items = entries.slice(0, 10);
  const boxRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  const count = items.length;
  useEffect(() => {
    const measure = () => {
      if (boxRef.current && copyRef.current) setScrolls(copyRef.current.offsetWidth > boxRef.current.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [count, entries]);

  const list = items.map((e, i) => (
    <span key={i} className="flex items-center gap-2">
      <span className="size-2.5 rounded-full" style={{ background: LINE_COLORS[e.line] }} />
      <span className="text-hud-dim">#{e.rank}</span> {e.displayName}{' '}
      <span className="font-mono" style={{ color: LINE_COLORS[e.line] }}>
        {e.score.toLocaleString()}
      </span>
    </span>
  ));
  return (
    <footer className="flex h-12 items-center overflow-hidden border-t border-hud-border bg-hud-panel">
      <span className="relative z-10 shrink-0 bg-hud-panel px-4 font-mono text-sm uppercase tracking-[0.2em] text-hud-dim">Today on the T</span>
      <div ref={boxRef} className="relative flex-1 overflow-hidden">
        {items.length ? (
          <div className={`flex w-max whitespace-nowrap text-lg ${scrolls ? 'animate-[ticker_40s_linear_infinite]' : ''}`}>
            <div ref={copyRef} className="flex gap-10 pr-10">
              {list}
            </div>
            {scrolls && (
              <div aria-hidden className="flex gap-10 pr-10">
                {list}
              </div>
            )}
          </div>
        ) : (
          <span className="text-lg text-hud-dim">No scores yet today. You could be first.</span>
        )}
      </div>
    </footer>
  );
}

function WinnerOverlay({
  phase,
  pending,
  color,
  videoRef,
  camEnabled,
  camError,
  camReady,
  typed,
  codeBad,
}: {
  phase: Phase;
  pending: { displayName: string; score: number; expiresAt: string } | null;
  color: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camEnabled: boolean;
  camError: string | null;
  camReady: boolean;
  typed: string;
  codeBad: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  let body: React.ReactNode;
  if (phase.kind === 'dispensing' || phase.kind === 'redeeming') {
    body = (
      <>
        <p className="text-6xl">⚙️</p>
        <h2 className="mt-4 text-6xl font-semibold">{phase.kind === 'redeeming' ? 'Checking code…' : 'Dispensing…'}</h2>
        {phase.kind === 'dispensing' && <p className="mt-4 text-3xl text-hud-dim">Here comes your sticker, {phase.name}</p>}
      </>
    );
  } else if (phase.kind === 'done') {
    body = phase.ok && phase.lightOnly ? (
      <>
        <p className="text-7xl">💡</p>
        <h2 className="mt-4 text-6xl font-semibold">Reward light on, {phase.name}!</h2>
        <p className="mt-4 text-3xl text-hud-dim">Grab your sticker from the crew.</p>
      </>
    ) : phase.ok ? (
      <>
        <p className="text-7xl">🎉</p>
        <h2 className="mt-4 text-6xl font-semibold">Enjoy your sticker, {phase.name}!</h2>
      </>
    ) : (
      <>
        <h2 className="text-5xl font-semibold">Claim confirmed, {phase.name}!</h2>
        <p className="mt-4 text-3xl text-hud-dim">The dispenser is offline. Grab your sticker from the crew.</p>
      </>
    );
  } else if (pending) {
    const left = Math.max(0, Math.ceil((Date.parse(pending.expiresAt) - now) / 1000));
    body = (
      <>
        <p className="font-mono text-xl uppercase tracking-[0.3em]" style={{ color }}>
          Car champion
        </p>
        <h2 className="mt-3 text-6xl font-semibold">{pending.displayName} wins this car!</h2>
        <p className="mt-3 text-3xl text-hud-dim">{pending.score.toLocaleString()} points</p>
        <p className="mt-8 text-2xl">Show your claim QR to the camera, or type the 6-letter code.</p>
        <div className={`mt-6 flex justify-center gap-3 ${codeBad ? 'animate-pulse' : ''}`} role="group" aria-label="Typed claim code">
          {Array.from({ length: CLAIM_CODE_LENGTH }, (_, i) => (
            <span
              key={i}
              className="grid size-16 place-items-center rounded-xl border-2 font-mono text-4xl font-semibold transition-colors"
              style={{
                borderColor: codeBad ? '#DA291C' : typed[i] ? color : '#1c2540',
                color: codeBad ? '#DA291C' : undefined,
                background: codeBad ? 'rgba(218,41,28,0.15)' : undefined,
              }}
            >
              {codeBad ? '' : (typed[i] ?? '')}
            </span>
          ))}
        </div>
        <p className="mt-4 font-mono text-lg text-hud-dim">expires in {left}s</p>
      </>
    );
  }

  const showCamera = camEnabled && phase.kind === 'idle' && !!pending;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center gap-12 bg-hud-bg/95 p-12 text-center backdrop-blur">
      <div className="max-w-3xl">{body}</div>
      <div className={showCamera ? 'flex flex-col items-center gap-3' : 'hidden'}>
        <div className="relative h-72 w-96">
          <video ref={videoRef} className="h-full w-full rounded-2xl border-4 object-cover" style={{ borderColor: color }} muted playsInline />
          {(camError || !camReady) && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-hud-panel p-4 text-center text-xl text-hud-dim">
              {camError ? 'Camera unavailable: type the code' : 'Starting camera…'}
            </div>
          )}
        </div>
        {camError && <p className="max-w-96 text-sm text-mbta-red">{camError}</p>}
      </div>
    </div>
  );
}
