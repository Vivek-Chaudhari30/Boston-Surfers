import { readFlags, type AdapterFlags } from '../flags';
import { HttpDispenser } from './http';
import { MockDispenser } from './mock';
import type { Dispenser } from './types';
import { WebSerialDispenser } from './web-serial';

export type { Dispenser, DispenserStatus, DispenseResult } from './types';
export { MockDispenser } from './mock';
export { HttpDispenser } from './http';
export { WebSerialDispenser, isWebSerialSupported, type SerialLogEntry } from './web-serial';

/** Pick the dispenser from `?dispenser=serial|http|mock` (default serial). Client only. */
export function createDispenser(
  flags: Pick<AdapterFlags, 'dispenser'> = readFlags(),
  opts: { kioskKey?: string | null } = {},
): Dispenser {
  if (flags.dispenser === 'mock') return new MockDispenser();
  if (flags.dispenser === 'http') return new HttpDispenser({ kioskKey: opts.kioskKey });
  return new WebSerialDispenser();
}
