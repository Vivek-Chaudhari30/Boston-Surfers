import type { DispenseResult, Dispenser, DispenserStatus } from './types';

export const MOCK_DISPENSE_MS = 1500;

/** Fallback dispenser (?dispenser=mock): pretends to drop a sticker after 1.5 s. */
export class MockDispenser implements Dispenser {
  readonly kind = 'mock' as const;
  private current: DispenserStatus = 'disconnected';
  private listeners = new Set<(s: DispenserStatus, detail?: string) => void>();

  status(): DispenserStatus {
    return this.current;
  }

  onStatus(cb: (s: DispenserStatus, detail?: string) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async connect(): Promise<void> {
    this.set('ready', 'mock dispenser');
  }

  async dispense(_id: string): Promise<DispenseResult> {
    if (this.current === 'busy') return { ok: false, error: 'BUSY' };
    if (this.current !== 'ready') return { ok: false, error: 'not connected' };
    this.set('busy');
    await new Promise((r) => setTimeout(r, MOCK_DISPENSE_MS));
    this.set('ready');
    return { ok: true };
  }

  async disconnect(): Promise<void> {
    this.set('disconnected');
  }

  private set(s: DispenserStatus, detail?: string) {
    this.current = s;
    for (const cb of this.listeners) cb(s, detail);
  }
}
