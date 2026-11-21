import type QrScannerType from 'qr-scanner';
import { codeFromQr } from './claim-code';
import type { RiderInput } from './types';

/**
 * Webcam QR scanner (qr-scanner / nimiq). Accepts only `CB1:<code>` payloads.
 * Needs a <video> element; the kiosk passes one it renders. Duplicate scans of the same
 * code within 5 s are dropped.
 */
export class WebcamQrRiderInput implements RiderInput {
  readonly kind = 'webcam-qr' as const;
  private scanner: QrScannerType | null = null;
  private lastCode: { code: string; at: number } | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  async start(onCode: (code: string) => void): Promise<void> {
    this.stop();
    // Dynamic import: qr-scanner touches browser globals at import time.
    const { default: QrScanner } = await import('qr-scanner');
    this.scanner = new QrScanner(
      this.video,
      (result) => {
        const code = codeFromQr(result.data);
        if (!code) return;
        const now = Date.now();
        if (this.lastCode && this.lastCode.code === code && now - this.lastCode.at < 5000) return;
        this.lastCode = { code, at: now };
        onCode(code);
      },
      { preferredCamera: 'user', maxScansPerSecond: 8, returnDetailedScanResult: true },
    );
    await this.scanner.start();
  }

  stop(): void {
    this.scanner?.stop();
    this.scanner?.destroy();
    this.scanner = null;
  }
}
