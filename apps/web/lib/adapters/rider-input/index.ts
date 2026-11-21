import { readFlags, type AdapterFlags } from '../flags';
import { KeyboardRiderInput } from './keyboard';
import type { RiderInput } from './types';
import { WebcamQrRiderInput } from './webcam-qr';

export type { RiderInput } from './types';
export { KeyboardRiderInput } from './keyboard';
export { WebcamQrRiderInput } from './webcam-qr';
export { codeFromQr, normalizeTypedCode } from './claim-code';

/**
 * Pick rider inputs from `?input=webcam|keyboard` (default webcam).
 * Keyboard input is ALWAYS included as a fallback (ARCHITECTURE §2.2).
 * Webcam needs a <video> element; without one only the keyboard is returned.
 */
export function createRiderInputs(
  video: HTMLVideoElement | null,
  flags: Pick<AdapterFlags, 'input'> = readFlags(),
): RiderInput[] {
  const inputs: RiderInput[] = [new KeyboardRiderInput()];
  if (flags.input === 'webcam' && video) inputs.push(new WebcamQrRiderInput(video));
  return inputs;
}
