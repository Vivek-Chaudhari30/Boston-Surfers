/// <reference types="w3c-web-serial" />
/**
 * Web Serial dispenser (ARCHITECTURE §5, host behavior). Chrome/Edge only, HTTPS or localhost.
 *
 * - connect(): reuses a previously granted port via getPorts(); otherwise requestPort()
 *   (which must run inside a click handler).
 * - Handshake: the Uno resets when the port opens, so wait up to 3 s for `READY`.
 *   If READY never shows (board didn't reset), fall back to a PING/PONG check.
 * - Heartbeat: PING every 5 s while idle; 2 missed PONGs → disconnected, then auto-reconnect.
 * - dispense(id): DISPENSE <id> → ACK <id> → DONE <id>. Fails on ERR <id> … or a 4 s timeout,
 *   and retries once with the same id (firmware is idempotent for the last successful id).
 * - Auto-reconnect: on USB unplug/replug (navigator.serial 'connect' event) and after heartbeat loss.
 */
import {
  CMD,
  SERIAL,
  SERIAL_TIMEOUTS,
  isValidDispenseId,
  parseLine,
  type SerialMessage,
} from '@cb/shared';
import type { DispenseResult, Dispenser, DispenserStatus } from './types';

export type SerialLogEntry = { at: number; dir: 'rx' | 'tx' | 'info'; line: string };

type Waiter = {
  match: (m: SerialMessage) => boolean;
  resolve: (m: SerialMessage) => void;
};

const RECONNECT_DELAY_MS = 1500;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export class WebSerialDispenser implements Dispenser {
  readonly kind = 'web-serial' as const;

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoopDone: Promise<void> | null = null;
  private current: DispenserStatus = 'disconnected';
  private statusListeners = new Set<(s: DispenserStatus, detail?: string) => void>();
  private logListeners = new Set<(e: SerialLogEntry) => void>();
  private waiters = new Set<Waiter>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private missedPongs = 0;
  private awaitingPong = false;
  private dispensing = false;
  private wantConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting: Promise<void> | null = null;
  private serialEventsBound = false;

  // ───────────── Dispenser interface ─────────────

  status(): DispenserStatus {
    return this.current;
  }

  onStatus(cb: (s: DispenserStatus, detail?: string) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  /** Connect. The first ever call must come from a user gesture (it may open the port picker). */
  async connect(): Promise<void> {
    if (!isWebSerialSupported()) {
      this.setStatus('error', 'Web Serial not supported (use Chrome or Edge over HTTPS/localhost)');
      throw new Error('Web Serial not supported');
    }
    this.bindSerialEvents();
    this.wantConnected = true;
    const granted = await navigator.serial.getPorts();
    const port = this.port ?? granted[0] ?? (await navigator.serial.requestPort());
    await this.openPort(port);
  }

  /** Reconnect to an already-granted port without a click. Resolves false if none is granted. */
  async autoConnect(): Promise<boolean> {
    if (!isWebSerialSupported()) return false;
    this.bindSerialEvents();
    const [port] = await navigator.serial.getPorts();
    if (!port) return false;
    this.wantConnected = true;
    try {
      await this.openPort(port);
      return true;
    } catch {
      return false;
    }
  }

  async dispense(id: string): Promise<DispenseResult> {
    if (!isValidDispenseId(id)) return { ok: false, error: `invalid id "${id}"` };
    if (this.current !== 'ready') return { ok: false, error: `dispenser ${this.current}` };
    if (this.dispensing) return { ok: false, error: 'BUSY' };

    this.dispensing = true;
    this.setStatus('busy', `dispensing ${id}`);
    let lastError = 'unknown';
    try {
      for (let attempt = 0; attempt <= SERIAL_TIMEOUTS.DISPENSE_RETRIES; attempt++) {
        if (attempt > 0) this.log('info', `retrying DISPENSE ${id} (${lastError})`);
        const outcome = this.waitFor(
          (m) => (m.type === 'DONE' || m.type === 'ERR') && m.id === id,
          SERIAL_TIMEOUTS.DISPENSE_MS,
        );
        try {
          await this.write(CMD.dispense(id));
        } catch (err) {
          lastError = errorMessage(err);
          continue;
        }
        const msg = await outcome;
        if (msg?.type === 'DONE') return { ok: true };
        lastError = msg?.type === 'ERR' ? `ERR ${msg.reason}` : 'timeout';
      }
      return { ok: false, error: lastError };
    } finally {
      this.dispensing = false;
      if (this.status() === 'busy') this.setStatus('ready');
    }
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.clearReconnect();
    await this.closePort();
    if (this.current !== 'disconnected') this.setStatus('disconnected', 'closed by host');
  }

  // ───────────── Extras for /dev/dispenser ─────────────

  /** Every raw line in/out, for the dev panel log. */
  onLog(cb: (e: SerialLogEntry) => void): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  ping(): Promise<void> {
    return this.write(CMD.ping());
  }

  requestStatus(): Promise<void> {
    return this.write(CMD.status());
  }

  servo(deg: number): Promise<void> {
    return this.write(CMD.servo(deg));
  }

  // ───────────── Internals ─────────────

  private async openPort(port: SerialPort): Promise<void> {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      this.clearReconnect();
      await this.closePort();
      this.port = port;
      this.setStatus('connecting', 'opening port');
      try {
        await port.open({
          baudRate: SERIAL.BAUD_RATE,
          dataBits: SERIAL.DATA_BITS,
          stopBits: SERIAL.STOP_BITS,
          parity: SERIAL.PARITY,
        });
      } catch (err) {
        const detail = errorMessage(err);
        this.setStatus('error', `open failed: ${detail} (is the Arduino IDE / monitor holding the port?)`);
        this.port = null;
        throw err;
      }
      this.log('info', `port open @ ${SERIAL.BAUD_RATE} baud`);
      this.readLoopDone = this.readLoop(port);

      // The Uno resets when the port opens: wait for READY before sending anything.
      const ready = await this.waitFor((m) => m.type === 'READY', SERIAL_TIMEOUTS.READY_MS);
      if (ready?.type === 'READY') {
        if (ready.version !== SERIAL.PROTOCOL_VERSION) {
          this.log('info', `warning: firmware protocol v${ready.version}, host expects v${SERIAL.PROTOCOL_VERSION}`);
        }
      } else {
        this.log('info', 'no READY within 3 s, trying PING');
        const pong = this.waitFor((m) => m.type === 'PONG', 1000);
        await this.write(CMD.ping()).catch(() => undefined);
        if (!(await pong)) {
          await this.closePort();
          this.setStatus('error', 'no READY or PONG from the board');
          this.scheduleReconnect();
          throw new Error('dispenser handshake failed');
        }
      }
      this.missedPongs = 0;
      this.awaitingPong = false;
      this.startHeartbeat();
      this.setStatus('ready');
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async readLoop(port: SerialPort): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    while (port.readable && this.port === port) {
      const reader = port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf(SERIAL.LINE_END)) >= 0) {
            const line = buffer.slice(0, nl).replace(/\r/g, '');
            buffer = buffer.slice(nl + 1);
            this.handleLine(line);
          }
          // Guard against a runaway line with no newline.
          if (buffer.length > SERIAL.MAX_LINE_LENGTH * 8) buffer = '';
        }
      } catch (err) {
        // Device lost (unplugged) or reader cancelled by closePort().
        if (this.port === port) this.log('info', `read error: ${errorMessage(err)}`);
        break;
      } finally {
        reader.releaseLock();
        this.reader = null;
      }
    }
    if (this.port === port) this.handleLost('port closed');
  }

  private handleLine(line: string) {
    if (line.trim() === '') return;
    this.log('rx', line);
    const msg = parseLine(line);
    if (!msg) return;
    if (msg.type === 'PONG') {
      this.awaitingPong = false;
      this.missedPongs = 0;
    }
    if (msg.type === 'READY' && this.current === 'ready') {
      // Board reset on its own (brownout?). Firmware state is fresh; keep going.
      this.log('info', 'board re-sent READY (reset?)');
    }
    for (const w of [...this.waiters]) {
      if (w.match(msg)) {
        this.waiters.delete(w);
        w.resolve(msg);
      }
    }
  }

  /** Resolve with the first matching message, or null after timeoutMs. */
  private waitFor(match: (m: SerialMessage) => boolean, timeoutMs: number): Promise<SerialMessage | null> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        resolve(null);
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  private async write(line: string): Promise<void> {
    const port = this.port;
    if (!port?.writable) throw new Error('port not open');
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(line + SERIAL.LINE_END));
      this.log('tx', line);
    } finally {
      writer.releaseLock();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (this.current !== 'ready' || this.dispensing) return; // only while idle
      if (this.awaitingPong) {
        this.missedPongs++;
        if (this.missedPongs >= SERIAL_TIMEOUTS.MAX_MISSED_PONGS) {
          this.log('info', `${this.missedPongs} missed PONGs`);
          void this.closePort().then(() => this.handleLost('heartbeat lost'));
          return;
        }
      }
      this.awaitingPong = true;
      this.write(CMD.ping()).catch(() => undefined);
    }, SERIAL_TIMEOUTS.PING_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private handleLost(reason: string) {
    this.stopHeartbeat();
    this.port = null;
    this.setStatus('disconnected', reason);
    this.scheduleReconnect();
  }

  private async closePort(): Promise<void> {
    this.stopHeartbeat();
    const port = this.port;
    this.port = null; // signals readLoop to stop without reporting a loss
    if (!port) return;
    try {
      await this.reader?.cancel();
    } catch {
      /* already closed */
    }
    await this.readLoopDone?.catch(() => undefined);
    this.readLoopDone = null;
    try {
      await port.close();
    } catch {
      /* already closed or unplugged */
    }
  }

  private scheduleReconnect() {
    if (!this.wantConnected || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.wantConnected || this.current === 'ready' || this.connecting) return;
      const [port] = await navigator.serial.getPorts();
      if (!port) return; // wait for the 'connect' event
      this.log('info', 'auto-reconnecting');
      this.openPort(port).catch(() => undefined);
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private bindSerialEvents() {
    if (this.serialEventsBound || !isWebSerialSupported()) return;
    this.serialEventsBound = true;
    navigator.serial.addEventListener('connect', () => {
      this.log('info', 'USB device connected');
      this.scheduleReconnect();
    });
    navigator.serial.addEventListener('disconnect', (e) => {
      if (e.target === this.port) {
        this.log('info', 'USB device unplugged');
        void this.closePort().then(() => this.handleLost('unplugged'));
      }
    });
  }

  private setStatus(s: DispenserStatus, detail?: string) {
    this.current = s;
    if (detail) this.log('info', `status: ${s} (${detail})`);
    for (const cb of this.statusListeners) cb(s, detail);
  }

  private log(dir: SerialLogEntry['dir'], line: string) {
    const entry = { at: Date.now(), dir, line };
    for (const cb of this.logListeners) cb(entry);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
