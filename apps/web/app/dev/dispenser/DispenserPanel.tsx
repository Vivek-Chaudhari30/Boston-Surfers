'use client';

import {
  WebSerialDispenser,
  isWebSerialSupported,
  type DispenserStatus,
  type SerialLogEntry,
} from '@/lib/adapters/dispenser';
import { SERIAL, SERIAL_TIMEOUTS } from '@cb/shared';
import { useEffect, useRef, useState } from 'react';

const STATUS_COLOR: Record<DispenserStatus, string> = {
  disconnected: 'bg-hud-dim',
  connecting: 'bg-mbta-orange',
  ready: 'bg-mbta-green',
  busy: 'bg-mbta-blue',
  error: 'bg-mbta-red',
};

const MAX_LOG = 500;

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function time(at: number) {
  return new Date(at).toLocaleTimeString([], { hour12: false }) + '.' + String(at % 1000).padStart(3, '0');
}

export function DispenserPanel() {
  const [dispenser] = useState(() => new WebSerialDispenser());
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<DispenserStatus>('disconnected');
  const [detail, setDetail] = useState<string>('');
  const [log, setLog] = useState<SerialLogEntry[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string>('');
  const [angle, setAngle] = useState(90);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only known after mount
    setSupported(isWebSerialSupported());
    const offStatus = dispenser.onStatus((s, d) => {
      setStatus(s);
      setDetail(d ?? '');
    });
    const offLog = dispenser.onLog((e) => setLog((l) => [...l.slice(-(MAX_LOG - 1)), e]));
    // Reconnect silently to a port granted earlier (no click needed).
    void dispenser.autoConnect();
    return () => {
      offStatus();
      offLog();
      void dispenser.disconnect();
    };
  }, [dispenser]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      setLastResult(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function dispense(id: string) {
    setLastId(id);
    setLastResult(`DISPENSE ${id}…`);
    const started = performance.now();
    const r = await dispenser.dispense(id);
    const ms = Math.round(performance.now() - started);
    setLastResult(r.ok ? `DONE ${id} in ${ms} ms` : `FAILED ${id}: ${r.error} (${ms} ms)`);
  }

  const connected = status === 'ready' || status === 'busy';

  if (supported === false) {
    return (
      <p className="rounded-lg border border-mbta-red p-4">
        Web Serial isn&apos;t available here. Use desktop Chrome or Edge on https:// or localhost.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-hud-border bg-hud-panel p-4">
        <span className={`h-3 w-3 rounded-full ${STATUS_COLOR[status]}`} />
        <span className="font-mono text-lg">{status}</span>
        {detail && <span className="font-mono text-sm text-hud-dim">{detail}</span>}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => run('connect', () => dispenser.connect())}
            disabled={status === 'connecting'}
            className="rounded bg-mbta-green px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {connected ? 'Reconnect' : 'Connect'}
          </button>
          <button
            onClick={() => run('disconnect', () => dispenser.disconnect())}
            disabled={!connected}
            className="rounded border border-hud-border px-4 py-2 disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-hud-border bg-hud-panel p-4 font-mono text-sm sm:grid-cols-2">
        <button disabled={!connected} onClick={() => run('PING', () => dispenser.ping())} className={btn}>
          PING
        </button>
        <button disabled={!connected} onClick={() => run('STATUS', () => dispenser.requestStatus())} className={btn}>
          STATUS
        </button>
        <button disabled={status !== 'ready'} onClick={() => dispense(randomId())} className={btn}>
          DISPENSE (random id)
        </button>
        <button disabled={status !== 'ready' || !lastId} onClick={() => lastId && dispense(lastId)} className={btn}>
          Repeat last id {lastId ? `(${lastId})` : ''}
        </button>
        <div className="flex gap-2 sm:col-span-2">
          <label className="flex items-center gap-2">
            SERVO
            <input
              type="number"
              min={0}
              max={180}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-24 rounded border border-hud-border bg-hud-bg px-2 py-2"
            />
            °
          </label>
          <button disabled={!connected} onClick={() => run('SERVO', () => dispenser.servo(angle))} className={btn}>
            Send SERVO
          </button>
        </div>
        {lastResult && <p className="sm:col-span-2">{lastResult}</p>}
      </section>

      <section className="rounded-xl border border-hud-border bg-hud-panel">
        <header className="flex items-center justify-between border-b border-hud-border px-4 py-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-hud-dim">Serial log</span>
          <button onClick={() => setLog([])} className="font-mono text-xs text-hud-dim">
            clear
          </button>
        </header>
        <div ref={logRef} className="h-80 overflow-y-auto px-4 py-2 font-mono text-xs leading-5">
          {log.length === 0 && <p className="text-hud-dim">No traffic yet.</p>}
          {log.map((e, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-hud-dim">{time(e.at)}</span>
              <span className={e.dir === 'rx' ? 'text-mbta-green' : e.dir === 'tx' ? 'text-mbta-orange' : 'text-hud-dim'}>
                {e.dir === 'rx' ? '←' : e.dir === 'tx' ? '→' : '·'}
              </span>
              <span className="whitespace-pre-wrap break-all">{e.line}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="font-mono text-xs text-hud-dim">
        Protocol v{SERIAL.PROTOCOL_VERSION} · {SERIAL.BAUD_RATE} baud · READY wait {SERIAL_TIMEOUTS.READY_MS} ms · PING
        every {SERIAL_TIMEOUTS.PING_INTERVAL_MS} ms · DISPENSE timeout {SERIAL_TIMEOUTS.DISPENSE_MS} ms ×
        {SERIAL_TIMEOUTS.DISPENSE_RETRIES + 1}. Close the Arduino IDE / arduino-cli monitor first: only one program can
        hold the port.
      </p>
    </div>
  );
}

const btn =
  'rounded border border-hud-border bg-hud-bg px-3 py-2 text-left hover:border-hud-dim disabled:cursor-not-allowed disabled:opacity-40';
