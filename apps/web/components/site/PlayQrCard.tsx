"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

type PlayLink = { url: string; local: boolean };

export function PlayQrCard() {
  const [link, setLink] = useState<PlayLink | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/game-link", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Link unavailable");
        const data: PlayLink = await res.json();
        const url = new URL(data.url);
        if (!["http:", "https:"].includes(url.protocol))
          throw new Error("Invalid play link");
        if (!controller.signal.aborted) {
          setLink(data);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="map-play-card" aria-labelledby="scan-play-title">
      <div className="map-play-kicker">
        <span aria-hidden>✦</span> NEXT STOP: YOUR HIGH SCORE
      </div>
      <h2 id="scan-play-title" className="comic-type">
        SCAN. PLAY. GO!
      </h2>
      <p>Your phone is the controller. The city is your playground.</p>
      <div className="map-play-qr">
        {link ? (
          <div
            className="map-play-qr-link"
            role="img"
            aria-label="Scan this QR to open your passenger page"
          >
            <QRCodeSVG
              value={link.url}
              size={176}
              level="M"
              marginSize={4}
              title="Scan to open Boston Surfers"
            />
          </div>
        ) : (
          <div className="map-play-placeholder" role="status">
            {error ? (
              <>
                Phone link unavailable.
                <button
                  onClick={() => {
                    setError(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Try again
                </button>
              </>
            ) : (
              "Preparing your game…"
            )}
          </div>
        )}
      </div>
      <p className="map-play-instruction">
        Open your camera. Scan the code. Chase the gold.
      </p>
      {link?.local && (
        <p className="map-play-network">Join the same Wi-Fi as this screen.</p>
      )}
      <div className="map-play-destination">
        YOUR GAME. YOUR WINS. YOUR PHONE.
      </div>
      <p className="map-play-note">Scan to open your personal passenger page</p>
    </section>
  );
}
