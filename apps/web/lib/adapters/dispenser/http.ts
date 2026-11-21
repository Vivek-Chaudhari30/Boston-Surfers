/**
 * HTTP dispenser for Jeet's Arduino UNO Q (ARCHITECTURE §5.1). The browser talks to our own
 * /api/device/* proxy, which forwards to the board at 127.0.0.1:8765 over the adb USB forward.
 *
 * - connect(): GET status; ready if the board answers.
 * - Heartbeat: GET status every 5 s while idle; 2 misses → disconnected (keeps retrying).
 * - dispense(id): POST reward; resolves when the board finishes. 4 s timeout, one retry with the
 *   same id (the board treats a repeat of the last id as a duplicate success, no second reward).
 * - `lastMode` is the board's reported mode. 'led-only' means a light, not a sticker: callers must
 *   not claim physical delivery for it.
 */
import { KIOSK_KEY_HEADER, SERIAL_TIMEOUTS, isValidDispenseId } from '@cb/shared';
import type { DispenseResult, Dispenser, DispenserStatus } from './types';

type RewardResponse = { ok?: boolean; id?: string; duplicate?: boolean; count?: number; mode?: string };
type ErrorBody = { error?: string; code?: string };

const KEY_STORAGE = 'cb:kiosk-key';

export class HttpDispenser implements Dispenser {
  readonly kind = 'http' as const;
  /** Board-reported mode of the last successful dispense, e.g. 'led-only'. */
  lastMode: string | null = null;

  private current: DispenserStatus = 'disconnected';
  private listeners = new Set<(s: DispenserStatus, detail?: string) => void>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private misses = 0;
  private busy = false;

  constructor(private readonly opts: { baseUrl?: string; kioskKey?: string | null } = {}) {}

  status(): DispenserStatus {
    return this.current;
  }

  onStatus(cb: (s: DispenserStatus, detail?: string) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async connect(): Promise<void> {
    this.set('connecting', 'checking board');
    const ok = await this.ping();
    this.startHeartbeat();
    if (!ok) {
      this.set('error', 'board unreachable');
      throw new Error('board unreachable: start the adb forward and server.py');
    }
  }

  async dispense(id: string): Promise<DispenseResult> {
    if (!isValidDispenseId(id)) return { ok: false, error: `invalid id "${id}"` };
    if (this.busy) return { ok: false, error: 'BUSY' };
    this.busy = true;
    this.set('busy', `dispensing ${id}`);
    let lastError = 'unknown';
    try {
      for (let attempt = 0; attempt <= SERIAL_TIMEOUTS.DISPENSE_RETRIES; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
        try {
          const res = await this.request('/reward', {
            method: 'POST',
            body: JSON.stringify({ id }),
            timeoutMs: SERIAL_TIMEOUTS.DISPENSE_MS,
          });
          const json = (await res.json().catch(() => ({}))) as RewardResponse & ErrorBody;
          if (res.ok && json.ok) {
            this.lastMode = json.mode ?? null;
            return { ok: true };
          }
          lastError = json.code ?? json.error ?? `HTTP ${res.status}`;
          if (res.status === 400) break; // invalid id: retrying won't help
        } catch (err) {
          lastError = err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : String(err);
        }
      }
      return { ok: false, error: lastError };
    } finally {
      this.busy = false;
      this.set(this.misses >= SERIAL_TIMEOUTS.MAX_MISSED_PONGS ? 'disconnected' : 'ready');
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.current !== 'disconnected') this.set('disconnected', 'closed by host');
  }

  /** GET status once; updates the status. */
  async ping(): Promise<boolean> {
    try {
      const res = await this.request('/status', { method: 'GET', timeoutMs: 3000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.misses = 0;
      if (!this.busy && this.current !== 'ready') this.set('ready', 'board online');
      return true;
    } catch {
      this.misses++;
      if (!this.busy && this.misses >= SERIAL_TIMEOUTS.MAX_MISSED_PONGS && this.current !== 'disconnected') {
        this.set('disconnected', 'board not answering');
      }
      return false;
    }
  }

  private startHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (!this.busy) void this.ping();
    }, SERIAL_TIMEOUTS.PING_INTERVAL_MS);
  }

  private kioskKey(): string | null {
    if (this.opts.kioskKey) return this.opts.kioskKey;
    try {
      return localStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  }

  private request(path: string, init: { method: 'GET' | 'POST'; body?: string; timeoutMs: number }) {
    const headers: Record<string, string> = {};
    if (init.body) headers['content-type'] = 'application/json';
    const key = this.kioskKey();
    if (key) headers[KIOSK_KEY_HEADER] = key;
    return fetch(`${this.opts.baseUrl ?? '/api/device'}${path}`, {
      method: init.method,
      headers,
      body: init.body,
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  }

  private set(s: DispenserStatus, detail?: string) {
    this.current = s;
    for (const cb of this.listeners) cb(s, detail);
  }
}
