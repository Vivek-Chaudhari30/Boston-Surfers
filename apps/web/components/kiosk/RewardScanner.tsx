"use client";
import Link from "next/link";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api-client";
import {
  decodeDemoReward,
  DEMO_REWARD_PREFIX,
  type DemoReward,
} from "@/lib/demo-reward";
import { RewardRedemption } from "@/lib/reward-claim";
import {
  WebcamQrRiderInput,
  normalizeTypedCode,
} from "@/lib/adapters/rider-input";
import { browserMatrixStatus, playBrowserMatrix } from "@/lib/adapters/dispenser/browser-matrix";
import { useKioskKey } from "./hooks";

type Result = import("zod").infer<typeof RewardRedemption>;
const MatrixStatus = z.object({ enabled: z.boolean(), connected: z.boolean() });
const MatrixReply = z.object({
  ok: z.literal(true),
  mode: z.literal("matrix-only"),
});
function animationId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
export function RewardScanner() {
  const params = useSearchParams();
  const storedKey = useKioskKey(params.get("key"));
  const [configuredKey, setConfiguredKey] = useState("");
  const kioskKey = configuredKey || storedKey;
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<WebcamQrRiderInput | null>(null);
  const busy = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [working, setWorking] = useState(false);
  const [cameraCheck, setCameraCheck] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [manual, setManual] = useState("");
  const [demo, setDemo] = useState<DemoReward | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [matrixConnection, setMatrixConnection] = useState<
    "checking" | "ready" | "offline"
  >("checking");
  const [matrixAnimation, setMatrixAnimation] = useState<
    "idle" | "playing" | "done" | "error"
  >("idle");
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const matrixOperation = useRef<{ payload: string; requestId: string } | null>(
    null,
  );
  useEffect(() => {
    let disposed = false;
    async function check() {
      try {
        if (window.location.origin === "https://constant-buffers.vercel.app") {
          await browserMatrixStatus();
          if (!disposed) setMatrixConnection("ready");
          return;
        }
        const status = await api("/api/demo/matrix", MatrixStatus, {
          signal: AbortSignal.timeout(3500),
        });
        if (disposed) return;
        setMatrixConnection(
          status.enabled && status.connected ? "ready" : "offline",
        );
      } catch {
        if (!disposed) setMatrixConnection("offline");
      }
    }
    const first = setTimeout(() => void check(), 0);
    const poll = setInterval(() => void check(), 5000);
    return () => {
      disposed = true;
      clearTimeout(first);
      clearInterval(poll);
    };
  }, []);
  const playMatrix = useCallback(
    async (operation: { payload: string; requestId: string }) => {
      setMatrixAnimation("playing");
      setMatrixError(null);
      try {
        if (window.location.origin === "https://constant-buffers.vercel.app") await playBrowserMatrix(operation.requestId);
        else await api("/api/demo/matrix", MatrixReply, { body: operation });
        setMatrixAnimation("done");
      } catch (err) {
        setMatrixAnimation("error");
        setMatrixError(errorText(err));
      }
    },
    [],
  );
  const submit = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      setDemo(null);
      scanner.current?.stop();
      setCameraReady(false);
      setCaptured(code);
      setWorking(true);
      setError(null);
      setResult(null);
      try {
        if (!kioskKey)
          throw new Error(
            "QR captured. Backend setup is required before this claim can be validated. No reward has been issued.",
          );
        const confirmation = await api(
          "/api/rewards/redeem",
          RewardRedemption,
          { body: { code }, kioskKey },
        );
        setResult(confirmation);
      } catch (err) {
        setError(errorText(err));
      } finally {
        busy.current = false;
        setWorking(false);
      }
    },
    [kioskKey],
  );
  const acceptDemo = useCallback(
    (payload: string) => {
      if (busy.current) return;
      const decoded = decodeDemoReward(payload);
      if (!decoded) {
        setError(
          "This demo QR is not supported. Generate a new reward on your phone.",
        );
        return;
      }
      scanner.current?.stop();
      setDemo(decoded);
      setCameraReady(false);
      setCameraError(null);
      setCaptured(null);
      setCameraCheck(false);
      setError(null);
      setResult(null);
      setWorking(false);
      const operation = { payload: decoded.payload, requestId: animationId() };
      matrixOperation.current = operation;
      setMatrixAnimation("idle");
      setMatrixError(null);
      void playMatrix(operation);
    },
    [playMatrix],
  );
  useEffect(() => {
    if (!video.current) return;
    const input = new WebcamQrRiderInput(video.current, {
      onReady: () => setCameraReady(true),
      onError: (message) => setCameraError(message),
      onDemoReward: acceptDemo,
      onCameraCheck: () => {
        input.stop();
        setCameraReady(false);
        setCameraCheck(true);
      },
    });
    scanner.current = input;
    void input.start((code) => void submit(code));
    return () => {
      input.stop();
      if (scanner.current === input) scanner.current = null;
    };
  }, [epoch, submit, acceptDemo]);
  function rescan() {
    matrixOperation.current = null;
    setMatrixAnimation("idle");
    setMatrixError(null);
    setDemo(null);
    setCameraCheck(false);
    setError(null);
    setCaptured(null);
    setResult(null);
    setCameraError(null);
    setCameraReady(false);
    setEpoch((value) => value + 1);
  }
  return (
    <section
      className="claim-display-content"
      aria-labelledby="claim-scanner-title"
    >
      <header className="claim-heading">
        <div>
          <p className="display-eyebrow">THE LAST STOP OF YOUR QUEST</p>
          <h1 className="comic-type" id="claim-scanner-title">
            CLAIM YOUR REWARD.
          </h1>
          <p>
            Show the one-time QR from your phone. This laptop’s camera does the
            rest.
          </p>
          <p className={`matrix-connection ${matrixConnection}`} role="status">
            {matrixConnection === "ready"
              ? "UNO Q LED MATRIX CONNECTED"
              : matrixConnection === "checking"
                ? "CHECKING USB MATRIX…"
                : "USB MATRIX OFFLINE · CHECK USB AND CHROME LOCAL NETWORK PERMISSION"}
          </p>
        </div>
        <Link href="/kiosk" className="claim-close">
          CLOSE CAMERA ×
        </Link>
      </header>
      <div className="claim-display-grid">
        <div className="claim-camera-card">
          <video
            ref={video}
            muted
            playsInline
            className="claim-camera-video"
            aria-label="Kiosk reward scanning camera"
          />
          {!captured && !cameraCheck && !demo && (
            <div className="claim-scan-guide" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          <div className="claim-camera-status" role="status">
            {demo
              ? "DEMO COUPON UNLOCKED"
              : cameraCheck
                ? "CAMERA CHECK PASSED · NO REWARD CLAIMED"
                : working
                  ? "VALIDATING CLAIM → ARDUINO"
                  : captured
                    ? `CAPTURED · ${captured}`
                    : cameraReady
                      ? "CAMERA LIVE · HOLD YOUR QR INSIDE THE FRAME"
                      : cameraError
                        ? "CAMERA UNAVAILABLE"
                        : "OPENING YOUR MAC CAMERA…"}
          </div>
          {(captured || cameraCheck || demo) && (
            <div className="claim-camera-result">
              <span aria-hidden>
                {demo
                  ? "★"
                  : cameraCheck || result?.state === "complete"
                    ? "✓"
                    : result?.state === "already_complete"
                      ? "↺"
                      : "⌁"}
              </span>
              <h2 className="comic-type">
                {demo
                  ? "HERE’S YOUR PROMO CODE!"
                  : cameraCheck
                    ? "CAMERA CHECK PASSED!"
                    : working
                      ? "CHECKING YOUR PASS…"
                      : result?.state === "complete"
                        ? "REWARD CONFIRMED!"
                        : result?.state === "already_complete"
                          ? "ALREADY CLAIMED."
                          : result?.state === "hardware_error"
                            ? "RECONNECT THE ARDUINO."
                            : "QR CAPTURED."}
              </h2>
              {demo && (
                <div className="claim-demo-promo">
                  <span>YOUR DEMO PROMO CODE</span>
                  <strong>{demo.promoCode}</strong>
                </div>
              )}
              <p>
                {demo
                  ? `${demo.offer} at ${demo.merchant}.`
                  : cameraCheck
                    ? "Your Mac camera read the phone’s test QR. This check creates no reward claim and does not trigger the Arduino."
                    : working
                      ? "The reward is confirmed only after the Arduino responds."
                      : result?.state === "complete"
                        ? result.mode === "matrix-only"
                          ? "The UNO Q’s blue LED matrix completed the winning animation."
                          : result.mode === "led-only"
                            ? "The UNO Q’s green LED confirmed your reward. This demonstration does not dispense a physical item."
                            : "The connected device confirmed the reward."
                        : result?.state === "already_complete"
                          ? "This reward was completed earlier. No second reward was triggered."
                          : (result?.detail ?? error)}
              </p>
              {demo && (
                <p className="matrix-animation-status" role="status">
                  {matrixAnimation === "playing"
                    ? "Playing your winning animation on the UNO Q…"
                    : matrixAnimation === "done"
                      ? "✓ UNO Q LED matrix animation completed"
                      : matrixAnimation === "error"
                        ? matrixError
                        : "The winning animation starts automatically."}
                </p>
              )}
              {demo && (
                <small className="claim-demo-disclaimer">
                  Example coupon · not redeemable at the business.
                </small>
              )}
            </div>
          )}
        </div>
        <aside className="claim-instructions">
          {!demo && (
            <div className="comic-site-card claim-steps">
              <p className="display-eyebrow">PHONE → CAMERA → REWARD</p>
              <h2 className="comic-type">ONE LAST THING.</h2>
              <ol>
                <li>
                  <b>01</b>
                  <span>
                    On your phone, tap <strong>I am Getting off</strong> under
                    Let’s roll.
                  </span>
                </li>
                <li>
                  <b>02</b>
                  <span>
                    Keep the reward QR bright, flat, and facing the laptop
                    camera.
                  </span>
                </li>
                <li>
                  <b>03</b>
                  <span>
                    Scan your demo reward QR to reveal your{" "}
                    <strong>promo code</strong>.
                  </span>
                </li>
              </ol>
            </div>
          )}
          {demo && (
            <div className="claim-demo-details comic-site-card">
              <p className="display-eyebrow">BOSTON EXPLORER · DEMO COUPON</p>
              <h2 className="comic-type">{demo.offer}</h2>
              <h3>{demo.merchant}</h3>
              <p>{demo.address}</p>
              <p>{demo.description}</p>
              <div className="claim-demo-ready">QR ACCEPTED · PROMO READY</div>
              <p className="demo-coupon-disclaimer">
                Example offer for the hackathon presentation. No purchase or
                actual merchant redemption is available.
              </p>
            </div>
          )}
          {result?.reward && (
            <div className="claim-reward-summary">
              <span>VERIFIED REWARD</span>
              <strong className="comic-type">{result.reward.offer}</strong>
              <b>{result.reward.merchant}</b>
              <p>Demo reward · merchant discounts are not live.</p>
            </div>
          )}
          {cameraError && !captured && (
            <div className="claim-notice" role="alert">
              <strong>Camera access is unavailable.</strong>
              <p>{cameraError}</p>
              <p>
                Allow camera access for this site, close other apps using it,
                then retry. Camera scanning needs localhost or HTTPS.
              </p>
              <button onClick={rescan}>RETRY CAMERA</button>
            </div>
          )}
          {error && !captured && (
            <p className="claim-notice" role="alert">
              {error}
            </p>
          )}
          {captured || cameraCheck || demo ? (
            <div className="claim-actions">
              {captured && (!result || result.state === "hardware_error") && (
                <button
                  disabled={working || !kioskKey}
                  className="personal-button comic-type"
                  onClick={() => void submit(captured)}
                >
                  RETRY THIS CLAIM
                </button>
              )}
              <button
                disabled={working}
                className="claim-secondary"
                onClick={rescan}
              >
                SCAN ANOTHER QR
              </button>
            </div>
          ) : (
            <form
              className="claim-manual"
              onSubmit={(event) => {
                event.preventDefault();
                if (manual.trim().startsWith(DEMO_REWARD_PREFIX)) {
                  acceptDemo(manual.trim());
                  return;
                }
                const code = normalizeTypedCode(manual);
                if (code) void submit(code);
                else
                  setError(
                    "Enter the six-character reward code shown on the phone.",
                  );
              }}
            >
              <label htmlFor="claim-code">
                Camera backup · paste QR data or enter a claim code.
              </label>
              <div>
                <input
                  id="claim-code"
                  value={manual}
                  onChange={(event) =>
                    setManual(event.target.value.toUpperCase())
                  }
                  maxLength={128}
                  placeholder="ABC234 or CBD1:…"
                  autoComplete="off"
                />
                <button disabled={working}>CHECK CODE</button>
              </div>
            </form>
          )}
          {!kioskKey && !demo && (
            <details className="claim-setup">
              <summary>Setup for ranked claims · demo coupons work now</summary>
              <p>
                Vivek’s backend must be configured. Use the existing kiosk key
                here; passenger sign-in stays on the phone.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draftKey.trim()) return;
                  try {
                    localStorage.setItem("cb:kiosk-key", draftKey.trim());
                  } catch {
                    /* In-memory key still works. */
                  }
                  setConfiguredKey(draftKey.trim());
                  setDraftKey("");
                  rescan();
                }}
              >
                <label htmlFor="claim-kiosk-key">Kiosk key</label>
                <input
                  id="claim-kiosk-key"
                  type="password"
                  autoComplete="off"
                  value={draftKey}
                  onChange={(event) => setDraftKey(event.target.value)}
                />
                <button>SAVE KIOSK SETUP</button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
