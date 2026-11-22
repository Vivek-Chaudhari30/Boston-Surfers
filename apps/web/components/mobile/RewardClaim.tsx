"use client";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/api-client";
import { RewardClaimView, RewardStatus } from "@/lib/reward-claim";

type ClaimView = import("zod").infer<typeof RewardClaimView>;
type Status = import("zod").infer<typeof RewardStatus>;
export function RewardClaim({
  code,
  onDone,
}: {
  code: string;
  onDone: () => void;
}) {
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const loadStatus = useCallback(async () => {
    const next = await api(
      `/api/rewards/${encodeURIComponent(code)}/status`,
      RewardStatus,
    );
    setStatus(next);
    return next;
  }, [code]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await loadStatus();
        if (cancelled || next.state !== "pending") return;
        const issued = await api("/api/rewards/claim", RewardClaimView, {
          body: { code },
        });
        if (!cancelled) {
          setClaim(issued);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      }
    };
    const first = setTimeout(() => {
      setNow(Date.now());
      void load();
    }, 0);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      void loadStatus().catch(() =>
        setError("Connection lost. Your reward is not confirmed yet."),
      );
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [code, attempt, loadStatus]);
  const expired =
    status?.state === "expired" ||
    (status?.state === "pending" && now >= Date.parse(status.expiresAt));
  const done = status?.state === "complete";
  const processing =
    status?.state === "processing" || status?.state === "hardware_error";
  const reward = claim?.reward ?? status?.reward;
  return (
    <section className="phone-claim personal-card" aria-live="polite">
      <p className="display-eyebrow">
        {done ? "CLAIM COMPLETE" : "YOUR ONE-TIME REWARD PASS"}
      </p>
      <h2 className="comic-type">
        {done
          ? "THAT’S A WIN!"
          : expired
            ? "THIS QR HAS EXPIRED."
            : processing
              ? "YOUR CLAIM WAS SCANNED."
              : "SHOW THIS TO THE KIOSK."}
      </h2>
      {reward && (
        <div className="phone-claim-reward">
          <strong className="comic-type">{reward.offer}</strong>
          <b>{reward.merchant}</b>
          <p>{reward.description}</p>
          <small>Demo reward · merchant discounts are not live.</small>
        </div>
      )}
      {done ? (
        <>
          <p>The kiosk confirmed your reward. This QR can’t be used again.</p>
          <button className="personal-button" onClick={onDone}>
            BACK TO MY WINNINGS
          </button>
        </>
      ) : expired ? (
        <>
          <p>This two-minute claim has expired. Ask the crew for help.</p>
          <button className="personal-button" onClick={onDone}>
            BACK TO MY WINNINGS
          </button>
        </>
      ) : processing ? (
        <>
          <p>
            {status?.state === "hardware_error"
              ? "Your claim is reserved. Ask the crew to reconnect the Arduino and tap Retry on the kiosk."
              : "The kiosk is checking the Arduino. Keep this page open for confirmation."}
          </p>
          <p className="phone-claim-code">{code}</p>
          {status?.state === "hardware_error" && (
            <div className="phone-claim-qr">
              <QRCodeSVG
                value={`CB1:${code}`}
                size={248}
                marginSize={4}
                level="M"
                title="Retry the reserved reward claim"
              />
            </div>
          )}
        </>
      ) : claim ? (
        <>
          <div className="phone-claim-qr">
            <QRCodeSVG
              value={claim.payload}
              size={248}
              marginSize={4}
              level="M"
              title="One-time ranked reward claim"
            />
          </div>
          <p className="phone-claim-code">{claim.code}</p>
          <p>
            On the laptop, tap <b>Claim your reward</b>. Hold this QR in front
            of its camera.
          </p>
          <p className="personal-footnote">
            Expires in{" "}
            {Math.max(0, Math.ceil((Date.parse(claim.expiresAt) - now) / 1000))}
            s · Turn up your phone’s brightness.
          </p>
        </>
      ) : !error ? (
        <p>Loading your ranked reward…</p>
      ) : null}
      {error && !done && (
        <p className="passenger-message" role="alert">
          {error}
          <button
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
