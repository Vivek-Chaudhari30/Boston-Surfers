"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api-client";
import { RewardRedemption } from "@/lib/reward-claim";
import {
  WebcamQrRiderInput,
  normalizeTypedCode,
} from "@/lib/adapters/rider-input";
import { useKioskKey } from "./hooks";

type Result = import("zod").infer<typeof RewardRedemption>;
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
  const [draftKey, setDraftKey] = useState("");
  const submit = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
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
  useEffect(() => {
    if (!video.current) return;
    const input = new WebcamQrRiderInput(video.current, {
      onReady: () => setCameraReady(true),
      onError: (message) => setCameraError(message),
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
  }, [epoch, submit]);
  function rescan() {
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
          {!captured && (
            <div className="claim-scan-guide" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          <div className="claim-camera-status" role="status">
            {cameraCheck
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
          {(captured || cameraCheck) && (
            <div className="claim-camera-result">
              <span aria-hidden>
                {cameraCheck || result?.state === "complete"
                  ? "✓"
                  : result?.state === "already_complete"
                    ? "↺"
                    : "⌁"}
              </span>
              <h2 className="comic-type">
                {cameraCheck
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
              <p>
                {cameraCheck
                  ? "Your Mac camera read the phone’s test QR. This check creates no reward claim and does not trigger the Arduino."
                  : working
                    ? "The reward is confirmed only after the Arduino responds."
                    : result?.state === "complete"
                      ? result.mode === "led-only"
                        ? "The UNO Q’s green LED confirmed your reward. This demonstration does not dispense a physical item."
                        : "The connected device confirmed the reward."
                      : result?.state === "already_complete"
                        ? "This reward was completed earlier. No second reward was triggered."
                        : (result?.detail ?? error)}
              </p>
            </div>
          )}
        </div>
        <aside className="claim-instructions">
          <div className="comic-site-card claim-steps">
            <p className="display-eyebrow">PHONE → CAMERA → UNO Q</p>
            <h2 className="comic-type">ONE LAST THING.</h2>
            <ol>
              <li>
                <b>01</b>
                <span>
                  On your phone, tap <strong>I am getting off</strong> after a
                  ranked ride.
                </span>
              </li>
              <li>
                <b>02</b>
                <span>
                  Keep the reward QR bright, flat, and facing the laptop camera.
                </span>
              </li>
              <li>
                <b>03</b>
                <span>
                  Wait for <strong>Reward confirmed</strong> and the Arduino’s
                  green LED.
                </span>
              </li>
            </ol>
          </div>
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
          {captured || cameraCheck ? (
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
                const code = normalizeTypedCode(manual);
                if (code) void submit(code);
                else
                  setError(
                    "Enter the six-character reward code shown on the phone.",
                  );
              }}
            >
              <label htmlFor="claim-code">
                Camera having trouble? Enter the code.
              </label>
              <div>
                <input
                  id="claim-code"
                  value={manual}
                  onChange={(event) =>
                    setManual(event.target.value.toUpperCase())
                  }
                  maxLength={6}
                  placeholder="ABC234"
                  autoComplete="off"
                />
                <button disabled={working}>CHECK CODE</button>
              </div>
            </form>
          )}
          {!kioskKey && (
            <details className="claim-setup">
              <summary>Kiosk setup needed · camera can still scan</summary>
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
