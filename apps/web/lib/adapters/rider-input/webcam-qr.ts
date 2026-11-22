import type QrScannerType from "qr-scanner";
import { codeFromQr } from "./claim-code";
import type { RiderInput } from "./types";

/**
 * Webcam QR scanner (qr-scanner / nimiq). Accepts only `CB1:<code>` payloads.
 * Needs a <video> element; the kiosk passes one it renders. Duplicate scans of the same
 * code within 5 s are dropped.
 */
export class WebcamQrRiderInput implements RiderInput {
  readonly kind = "webcam-qr" as const;
  private scanner: QrScannerType | null = null;
  private lastCode: { code: string; at: number } | null = null;

  /** Bumped by every start()/stop(); a start() that sees a newer generation after an await bails out. */
  private generation = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly hooks: {
      onReady?: () => void;
      onError?: (message: string) => void;
      onCameraCheck?: () => void;
    } = {},
  ) {}

  async start(onCode: (code: string) => void): Promise<void> {
    this.stop();
    const gen = this.generation;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.hooks.onError?.(
        "This browser cannot provide camera access. Open http://localhost:3001/kiosk/claim in Chrome on this Mac.",
      );
      return;
    }
    try {
      // Dynamic import: qr-scanner touches browser globals at import time.
      const { default: QrScanner } = await import("qr-scanner");
      if (gen !== this.generation) return;
      const scanner = new QrScanner(
        this.video,
        (result) => {
          if (gen !== this.generation) return;
          if (result.data.trim() === "CB-CAMERA-CHECK") {
            this.hooks.onCameraCheck?.();
            return;
          }
          const code = codeFromQr(result.data);
          if (!code) return;
          const now = Date.now();
          if (
            this.lastCode &&
            this.lastCode.code === code &&
            now - this.lastCode.at < 5000
          )
            return;
          this.lastCode = { code, at: now };
          onCode(code);
        },
        {
          preferredCamera: "user",
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
        },
      );
      this.scanner = scanner;
      await scanner.start();
      if (gen !== this.generation) {
        // stop() ran while the camera was opening: release it.
        scanner.stop();
        scanner.destroy();
        if (this.scanner === scanner) this.scanner = null;
        return;
      }
      this.hooks.onReady?.();
    } catch (err) {
      if (gen !== this.generation) return;
      this.scanner?.destroy();
      this.scanner = null;
      this.hooks.onError?.(err instanceof Error ? err.message : String(err));
    }
  }

  stop(): void {
    this.generation++;
    this.scanner?.stop();
    this.scanner?.destroy();
    this.scanner = null;
  }
}
