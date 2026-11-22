import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const scannerMock = vi.hoisted(() => ({
  callback: null as ((result: { data: string }) => void) | null,
  stop: vi.fn(),
  destroy: vi.fn(),
  start: vi.fn(),
}));
vi.mock("qr-scanner", () => ({
  default: class {
    constructor(_video: unknown, callback: (result: { data: string }) => void) {
      scannerMock.callback = callback;
    }
    start = scannerMock.start;
    stop = scannerMock.stop;
    destroy = scannerMock.destroy;
  },
}));
import { WebcamQrRiderInput } from "./webcam-qr";
import { codeFromQr } from "./claim-code";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  scannerMock.start.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe("Mac camera scanner lifecycle", () => {
  it("separates camera-check QR from reward claims", async () => {
    const claim = vi.fn(),
      check = vi.fn();
    const input = new WebcamQrRiderInput({} as HTMLVideoElement, {
      onCameraCheck: check,
    });
    await input.start(claim);
    scannerMock.callback?.({ data: "CB-CAMERA-CHECK" });
    expect(check).toHaveBeenCalledOnce();
    expect(claim).not.toHaveBeenCalled();
    expect(codeFromQr("CB-CAMERA-CHECK")).toBeNull();
    input.stop();
  });
  it("routes a demo coupon only to the demo display callback", async () => {
    const claim = vi.fn(),
      demo = vi.fn(),
      check = vi.fn();
    const input = new WebcamQrRiderInput({} as HTMLVideoElement, {
      onDemoReward: demo,
      onCameraCheck: check,
    });
    await input.start(claim);
    scannerMock.callback?.({ data: "CBD1:P1:1234ABCD" });
    expect(demo).toHaveBeenCalledWith("CBD1:P1:1234ABCD");
    expect(claim).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    input.stop();
  });
  it("reads a proper claim once, ignores unrelated QR codes and blocks stale callbacks after close", async () => {
    const claim = vi.fn();
    const input = new WebcamQrRiderInput({} as HTMLVideoElement);
    await input.start(claim);
    scannerMock.callback?.({ data: "https://example.com" });
    scannerMock.callback?.({ data: "CB1:ABC234" });
    scannerMock.callback?.({ data: "CB1:ABC234" });
    expect(claim.mock.calls).toEqual([["ABC234"]]);
    input.stop();
    scannerMock.callback?.({ data: "CB1:XYZ567" });
    expect(claim).toHaveBeenCalledOnce();
    expect(scannerMock.stop).toHaveBeenCalled();
    expect(scannerMock.destroy).toHaveBeenCalled();
  });
  it("shows a clear error instead of waiting forever in unsupported preview browsers", async () => {
    vi.stubGlobal("window", { isSecureContext: false });
    const error = vi.fn();
    const input = new WebcamQrRiderInput({} as HTMLVideoElement, {
      onError: error,
    });
    await input.start(vi.fn());
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Chrome on this Mac"),
    );
    expect(scannerMock.start).not.toHaveBeenCalled();
  });
  it("releases a camera that finishes opening after the page closes", async () => {
    let finish: () => void = () => {};
    scannerMock.start.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const ready = vi.fn();
    const input = new WebcamQrRiderInput({} as HTMLVideoElement, {
      onReady: ready,
    });
    const pending = input.start(vi.fn());
    await vi.waitFor(() => expect(scannerMock.start).toHaveBeenCalledOnce());
    input.stop();
    finish();
    await pending;
    expect(ready).not.toHaveBeenCalled();
    expect(scannerMock.destroy).toHaveBeenCalled();
  });
});
