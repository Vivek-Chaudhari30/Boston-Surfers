import { CLAIM_CODE_LENGTH } from '@cb/shared';
import { isClaimCodeChar, normalizeTypedCode } from './claim-code';
import type { RiderInput } from './types';

/**
 * Typed claim code fallback. Always listening on the kiosk: type the 6 characters
 * (Enter optional). Ignores keystrokes inside inputs/textareas. Esc or Backspace edits the buffer.
 */
export class KeyboardRiderInput implements RiderInput {
  readonly kind = 'keyboard' as const;
  private buffer = '';
  private handler: ((e: KeyboardEvent) => void) | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  async start(onCode: (code: string) => void): Promise<void> {
    this.stop();
    this.handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') this.buffer = '';
      else if (e.key === 'Backspace') this.buffer = this.buffer.slice(0, -1);
      else if (e.key === 'Enter') {
        const code = normalizeTypedCode(this.buffer);
        this.buffer = '';
        if (code) onCode(code);
        return;
      } else if (isClaimCodeChar(e.key)) {
        this.buffer = (this.buffer + e.key.toUpperCase()).slice(-CLAIM_CODE_LENGTH);
        const code = normalizeTypedCode(this.buffer);
        if (code && this.buffer.length === CLAIM_CODE_LENGTH) {
          this.buffer = '';
          onCode(code);
        }
      } else return;

      // Forget a half-typed code after 10 s idle.
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => (this.buffer = ''), 10_000);
    };
    window.addEventListener('keydown', this.handler);
  }

  stop(): void {
    if (this.handler) window.removeEventListener('keydown', this.handler);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.handler = null;
    this.buffer = '';
  }
}
