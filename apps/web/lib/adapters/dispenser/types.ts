export type DispenserStatus = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error';

export type DispenseResult = { ok: true } | { ok: false; error: string };

export interface Dispenser {
  readonly kind: 'web-serial' | 'mock' | 'http'; // 'http' = future ESP32 over Wi-Fi
  connect(): Promise<void>; // web-serial: must run from a click the first time
  status(): DispenserStatus;
  onStatus(cb: (s: DispenserStatus, detail?: string) => void): () => void;
  dispense(id: string): Promise<DispenseResult>;
  disconnect(): Promise<void>;
}
