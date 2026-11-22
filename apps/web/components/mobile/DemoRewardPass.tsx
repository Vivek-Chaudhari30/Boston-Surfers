"use client";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { DemoReward } from "@/lib/demo-reward";

export function DemoRewardPass({
  reward,
  onClose,
}: {
  reward: DemoReward;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.documentElement.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="demo-reward-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (event.key !== "Tab") return;
        const focusable = [
          ...(panel.current?.querySelectorAll<HTMLElement>("button, input") ??
            []),
        ];
        const first = focusable[0],
          last = focusable.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <section
        className="demo-reward-pass"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-award-title"
      >
        <header>
          <span>YOUR BOSTON DEMO REWARD</span>
          <button onClick={onClose} aria-label="Close reward QR">
            ×
          </button>
        </header>
        <h2 id="demo-award-title" className="comic-type">
          YOU’VE GOT A LITTLE EXTRA.
        </h2>
        <div className="demo-phone-offer">
          <strong className="comic-type">{reward.offer}</strong>
          <b>{reward.merchant}</b>
          <p>{reward.address}</p>
        </div>
        <div className="demo-phone-qr">
          <QRCodeSVG
            value={reward.payload}
            size={216}
            marginSize={4}
            level="M"
            title="Scan at the kiosk to reveal a demo promo code"
          />
        </div>
        <p className="demo-phone-instruction">
          On the laptop, tap <b>Claim your reward</b>.<br />
          Show this QR to its camera to reveal your promo code.
        </p>
        <details className="demo-qr-backup">
          <summary>Camera backup · copy QR data</summary>
          <input
            readOnly
            value={reward.payload}
            aria-label="Demo QR data"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reward.payload);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "COPIED" : "COPY QR DATA"}
          </button>
        </details>
        <p className="demo-coupon-disclaimer">
          Example coupon for this presentation. Not redeemable at the business.
        </p>
        <button className="personal-button comic-type" onClick={onClose}>
          BACK TO MY PASS
        </button>
      </section>
    </div>
  );
}
