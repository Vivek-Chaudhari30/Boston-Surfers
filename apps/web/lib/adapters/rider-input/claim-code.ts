import { CLAIM_CODE_ALPHABET, CLAIM_CODE_LENGTH, CLAIM_QR_PREFIX } from '@cb/shared';

const CODE_RE = new RegExp(`^[${CLAIM_CODE_ALPHABET}]{${CLAIM_CODE_LENGTH}}$`);

/** Accept only `CB1:<code>` QR payloads. Returns the bare code, or null. */
export function codeFromQr(payload: string): string | null {
  const text = payload.trim();
  if (!text.startsWith(CLAIM_QR_PREFIX)) return null;
  const code = text.slice(CLAIM_QR_PREFIX.length).toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** A typed code (no prefix needed). Returns the normalized code, or null. */
export function normalizeTypedCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function isClaimCodeChar(ch: string): boolean {
  return ch.length === 1 && CLAIM_CODE_ALPHABET.includes(ch.toUpperCase());
}
