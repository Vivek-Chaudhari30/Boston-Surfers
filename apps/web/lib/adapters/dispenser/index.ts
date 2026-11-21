import { readFlags, type AdapterFlags } from '../flags';
import { MockDispenser } from './mock';
import type { Dispenser } from './types';
import { WebSerialDispenser } from './web-serial';

export type { Dispenser, DispenserStatus, DispenseResult } from './types';
export { MockDispenser } from './mock';
export { WebSerialDispenser, isWebSerialSupported, type SerialLogEntry } from './web-serial';

/** Pick the dispenser from `?dispenser=serial|mock` (default serial). Client only. */
export function createDispenser(flags: Pick<AdapterFlags, 'dispenser'> = readFlags()): Dispenser {
  return flags.dispenser === 'mock' ? new MockDispenser() : new WebSerialDispenser();
}
