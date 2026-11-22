"use client";

import { useEffect, useState } from "react";

const NOTIFICATION_INTERVAL = 25_000;
const VISIBLE_TIME = 12_000;
const NOTICES = [
  { kind: "tip", label: "HOW TO PLAY", icon: "↗", title: "Your next adventure starts here.", body: "Scan the QR on the right with your phone. Play Boston Surfers while you ride." },
  { kind: "delay", label: "DEMO SERVICE ALERT · GREEN LINE", icon: "!", title: "A little extra time on the Green Line.", body: "Example: allow 5–10 extra minutes near Kenmore. This is a simulated delay, not a live MBTA alert." },
  { kind: "reward", label: "REWARD CHECKPOINT", icon: "★", title: "Getting off? Grab your reward QR.", body: "Tap “I am Getting off” on your phone. Open “Claim your reward” here and show your QR to the camera." },
  { kind: "tip", label: "CHASE THE HIGH SCORE", icon: "↗", title: "Make your name on the leaderboard.", body: "Play on your phone and watch the leaderboard here. Your personal winnings and ride history stay on your phone." },
  { kind: "delay", label: "DEMO SERVICE ALERT · RED LINE", icon: "!", title: "A slower ride through downtown.", body: "Example: Red Line trains may pause near Park Street for signal checks. Simulated service notice for this demo." },
  { kind: "reward", label: "DISCOVER BOSTON", icon: "★", title: "Next stop: a neighborhood reward.", body: "Open Rewards at the top to explore station-by-station sample coupons. Offers are for the demo, not merchant redemption." },
  { kind: "tip", label: "DEMO TIP · WINNING FINISH", icon: "✓", title: "Scan. Reveal. Celebrate.", body: "A winning demo QR reveals a promo code here and automatically plays the UNO Q’s blue LED matrix animation." },
] as const;

/** One readable toast every 25 seconds, with quiet map time between messages. */
export function KioskNotifications() {
  const [sequence, setSequence] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setSequence((value) => value + 1);
      setVisible(true);
    }, NOTIFICATION_INTERVAL);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_TIME);
    return () => clearTimeout(timer);
  }, [sequence]);
  const notice = NOTICES[sequence % NOTICES.length];
  return (
    <div className="kiosk-notification-slot" role="status" aria-live="polite" aria-atomic="true">
      {visible && (
        <article className={`kiosk-notification ${notice.kind}`} key={sequence}>
          <span className="kiosk-notification-icon" aria-hidden="true">{notice.icon}</span>
          <div>
            <p className="kiosk-notification-label">{notice.label}</p>
            <h2 className="comic-type">{notice.title}</h2>
            <p className="kiosk-notification-body">{notice.body}</p>
          </div>
          <button className="kiosk-notification-close" aria-label="Dismiss notification" onClick={() => setVisible(false)}>×</button>
          <span className="kiosk-notification-progress" aria-hidden="true" />
        </article>
      )}
    </div>
  );
}
