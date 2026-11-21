'use client';

import { OkResponse, type TrainVehicle } from '@cb/shared';
import { useEffect, useState } from 'react';
import { WebSerialDispenser, type Dispenser, type DispenserStatus } from '@/lib/adapters/dispenser';
import type { AdapterFlags } from '@/lib/adapters/flags';
import { api, errorText } from '@/lib/api-client';

/** Hidden kiosk status panel (Shift+D): feed, dispenser, realtime, vehicle pinning. */
export function DevPanel(props: {
  carId: string;
  kioskKey: string;
  flags: AdapterFlags;
  feedMode: 'live' | 'replay';
  setFeedMode: (m: 'live' | 'replay') => void;
  feedError: string | null;
  dispenser: Dispenser;
  dispenserStatus: DispenserStatus;
  realtimeHits: number;
  youVehicleId: string | null;
  lineVehicles: TrainVehicle[];
  onPinned: () => void;
  onClose: () => void;
  onTestCode: (code: string) => void;
}) {
  const [health, setHealth] = useState<string>('…');
  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { checks?: Record<string, string> }) =>
        setHealth(Object.entries(j.checks ?? {}).map(([k, v]) => `${k}:${v}`).join('  ')),
      )
      .catch(() => setHealth('unreachable'));
  }, []);

  async function pin(vehicleId: string) {
    try {
      await api(`/api/cars/${props.carId}/vehicle`, OkResponse, { body: { vehicleId }, kioskKey: props.kioskKey });
      setMsg(`Pinned ${vehicleId}`);
      props.onPinned();
    } catch (err) {
      setMsg(errorText(err));
    }
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      const r = await fn();
      setMsg(`${label}: ${r && typeof r === 'object' ? JSON.stringify(r) : 'ok'}`);
    } catch (err) {
      setMsg(`${label}: ${errorText(err)}`);
    }
  }

  const d = props.dispenser;
  const row = 'flex items-center justify-between gap-3 border-b border-hud-border py-2';
  const btn = 'rounded border border-hud-border px-3 py-1 hover:border-hud-dim';

  return (
    <div className="fixed right-4 top-4 z-50 max-h-[92vh] w-[440px] overflow-y-auto rounded-2xl border border-hud-border bg-hud-panel/95 p-5 font-mono text-sm shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="uppercase tracking-[0.2em] text-hud-dim">Kiosk status</span>
        <button onClick={props.onClose} className={btn}>
          close (Shift+D)
        </button>
      </div>

      <div className={row}>
        <span>Server</span>
        <span className="text-right text-xs text-hud-dim">{health}</span>
      </div>

      <div className={row}>
        <span>
          Feed: <b>{props.feedMode}</b>
          {props.feedError && <span className="block text-xs text-mbta-red">{props.feedError}</span>}
        </span>
        <button className={btn} onClick={() => props.setFeedMode(props.feedMode === 'live' ? 'replay' : 'live')}>
          switch to {props.feedMode === 'live' ? 'replay' : 'live'}
        </button>
      </div>

      <div className={row}>
        <span>
          Dispenser ({d.kind}): <b>{props.dispenserStatus}</b>
        </span>
        <span className="flex gap-2">
          <button className={btn} onClick={() => run('connect', () => d.connect())}>
            connect
          </button>
          <button
            className={btn}
            disabled={props.dispenserStatus !== 'ready'}
            onClick={() => run('test dispense', () => d.dispense(`t${Date.now().toString(36).slice(-6)}`))}
          >
            test
          </button>
          {d instanceof WebSerialDispenser && (
            <button className={btn} onClick={() => run('ping', () => d.ping())}>
              ping
            </button>
          )}
        </span>
      </div>

      <div className={row}>
        <span>Realtime hints received</span>
        <span>{props.realtimeHits}</span>
      </div>

      <div className={row}>
        <span>Flags</span>
        <span className="text-xs text-hud-dim">
          feed={props.flags.feed} dispenser={props.flags.dispenser} input={props.flags.input}
        </span>
      </div>

      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          props.onTestCode(code.toUpperCase());
          setCode('');
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="claim code"
          maxLength={6}
          className="w-32 rounded border border-hud-border bg-hud-bg px-2 py-1 uppercase"
        />
        <button className={btn}>redeem</button>
      </form>

      <div className="mt-3">
        <p className="mb-2 text-hud-dim">Pin this kiosk&apos;s train (current: {props.youVehicleId ?? 'none'})</p>
        <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto">
          {props.lineVehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => pin(v.id)}
              className={`rounded border px-2 py-1 text-left text-xs ${v.id === props.youVehicleId ? 'border-white' : 'border-hud-border'}`}
            >
              {v.label} · {v.route} · {v.stationId.replace('place-', '')}
            </button>
          ))}
          {props.lineVehicles.length === 0 && <p className="text-hud-dim">No vehicles on this line in the feed.</p>}
        </div>
      </div>

      {msg && <p className="mt-3 break-all text-xs text-hud-dim">{msg}</p>}
    </div>
  );
}
