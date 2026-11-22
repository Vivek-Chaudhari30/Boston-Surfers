"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
export default function CameraCheckPage() {
  return (
    <main className="passenger-shell">
      <div className="passenger-content">
        <p className="display-eyebrow">MAC CAMERA CHECK</p>
        <h1 className="comic-type">TEST THE SCANNER.</h1>
        <section className="personal-card phone-claim">
          <h2 className="comic-type">HOLD THIS TO THE LAPTOP.</h2>
          <div className="phone-claim-qr">
            <QRCodeSVG
              value="CB-CAMERA-CHECK"
              size={248}
              marginSize={4}
              level="M"
              title="Camera check only; not a reward claim"
            />
          </div>
          <p>
            On the laptop, open <b>Claim your reward</b>. Hold your phone steady
            with this QR facing the camera.
          </p>
          <p className="personal-footnote">
            The laptop should show “Camera check passed.” This diagnostic QR
            creates no reward claim and never triggers the Arduino.
          </p>
        </section>
        <Link href="/mobile" className="personal-button">
          BACK TO MY PASS
        </Link>
      </div>
    </main>
  );
}
