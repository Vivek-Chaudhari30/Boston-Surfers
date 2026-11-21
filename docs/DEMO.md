# Demo guide

The 2-minute script, the exact URLs, the pre-judging checklist and the fallback drill. Design background is in [ARCHITECTURE.md §8](ARCHITECTURE.md). Never paste real secrets here: `<KIOSK_SECRET>` is the value from `apps/web/.env.local`.

## Kiosk URLs

All start with `/kiosk/green-3812?key=<KIOSK_SECRET>` and add flags.

| Purpose | URL |
|---|---|
| **Judging (UNO Q on the Mac)** | `http://localhost:3000/kiosk/green-3812?key=<KIOSK_SECRET>&dispenser=http` (run `pnpm kiosk` first, see below) |
| Judging, no board attached | `…&dispenser=mock` (animation only, no hardware) |
| Judging, serial Arduino | `…&dispenser=serial` (Chrome, click Connect once) |
| Force recorded trains | add `&feed=replay` (optionally `&replay=<file>` from `public/replay/`) |
| Keyboard-only claim | add `&input=keyboard` (webcam off) |
| Pin a specific train | add `&vehicle=<id>` |

A plain URL with no `?dispenser=` defaults to `serial`, which is **offline** unless a serial port is connected. Always add the flag. The dim chip at the bottom-right of the kiosk shows `dispenser: ready` or `offline (<transport>)`; if it says offline, fix it before the judges arrive.

**Kiosk on the Mac:** the UNO Q is only reachable from the Mac, so the kiosk runs there with `pnpm kiosk` (production build on :3000). Phones still use the Vercel site, because the QR points at `NEXT_PUBLIC_APP_URL` from `apps/web/.env.production.local`.

## 2-minute script

| Time | Do | Judges see |
|---|---|---|
| 0:00-0:20 | Full-screen the kiosk (`F11` / Cmd+Ctrl+F). Point at the YOU marker and the transfer card. | Trains moving on the Spider-Tracker map, YOU on our Green car, "Next Red at Park St: 3 min". |
| 0:20-0:40 | A judge scans the rotating QR, types a name and phone, joins Car 3812. | Toast "New rider aboard" and the rider appears in the car list. |
| 0:40-1:15 | Judge plays the runner; you play on a second phone. The seeded riders are beatable (480 and below). | The car board updates live on the kiosk. |
| 1:15-1:40 | Judge taps "I'm getting off" twice. Kiosk shows "<name> wins this car!". Judge holds the claim QR to the webcam (or types the 6-character code). | Code boxes fill, redeem, the dispenser fires, the phone says "Claim confirmed". |
| 1:40-2:00 | Show the ticker and the website (`/`, `/leaderboard`). Pitch: adapters swap the webcam for a CharlieCard tap, the MacBook for a car-mounted Pi screen, USB for an ESP32 over Wi-Fi. | Daily leaders, the same data on the public site. |

### Optional: Car Race (30 s, if two judges are scanning)
- Both judges tap **🏁 Car Race** in the phone lobby. The kiosk map turns into a 15 s countdown with their names.
- At GO, each taps **START RUN**. Everyone plays the same course, and the kiosk shows live bars (💥 = crashed).
- When everyone has crashed, the kiosk shows the official podium. Race scores count on the car board, so the sticker rule doesn't change.
- Needs the kiosk page open (it hosts the race) and Supabase Realtime. If Realtime is down, the phone offers "Play solo".

## Pre-judging checklist

Do this about 15 minutes before, and again if the kiosk was idle for over 90 minutes (rides expire after 90 min).

- [ ] **Seed the car:** `pnpm tsx scripts/seed-demo.ts` (add `--clear` to remove the fake riders afterwards). Needs `apps/web/.env.local`.
- [ ] **UNO Q reachable:**
  ```bash
  UNOQ_ADB="$HOME/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb"
  "$UNOQ_ADB" -s 3454450778 forward tcp:8765 tcp:8765
  "$UNOQ_ADB" -s 3454450778 shell 'python3 /tmp/cb-unoq-web/server.py --port 8765'   # keep this terminal open
  ```
  Port **8765** (see `firmware/unoq_web/README.md`; if the board files vanished after a reboot, re-push them with the commands there). Check `http://localhost:8765` says "Connected".
- [ ] **Start the kiosk:** `pnpm kiosk`, open the judging URL above.
- [ ] **Chip is green:** bottom-right says `dispenser: ready (http)`. Shift+D should show "Dispenser (http): ready"; press Test to see the LED.
- [ ] **Re-pin a moving train:** press `Shift+D`, pin a train marked with a star (moving, not at a terminus) on the Green Line. A terminus train shows "waiting to depart" and looks dead. If the card says "Pinned train left service", re-pin.
- [ ] **Health:** open `https://constant-buffers.vercel.app/api/health` (and `/api/health` on the kiosk): every backend `ok`.
- [ ] **Trains visible:** more than 50 trains on the map. Overnight (about 1-5 AM) use `&feed=replay`.
- [ ] **Phones:** screen brightness up, auto-lock off, cellular on in case venue Wi-Fi is bad. Do one full test signup and run, then delete test riders (phones `+1555990xxxx`).
- [ ] **Kiosk Mac:** Chrome full screen, camera permission granted, notifications off, charger plugged in, hotspot ready.
- [ ] **Backup:** the 2-minute screen recording is on the desktop.

## Fallback drill

Drill each row once. Shift+D opens the hidden panel (feed, dispenser, realtime, manual redeem, pin).

| If this fails | Flag / action |
|---|---|
| Venue Wi-Fi | Put the Mac on a phone hotspot. Judges use cellular. Kiosk keeps the map via `?feed=replay`. |
| MBTA API, or no trains (about 1-5 AM) | Kiosk drops to replay after 3 failed fetches. Force it with `&feed=replay` (loops `public/replay/demo.json`, about 30 min). Re-record in the evening with `pnpm tsx scripts/record-mbta.ts --minutes 60`, then `pnpm tsx scripts/trim-replay.ts --in apps/web/public/replay/<file>.json --out apps/web/public/replay/demo.json --minutes 30`. |
| Webcam scan | Type the 6-character code on the Mac keyboard (always listening; click the page once if it ignores keys). Or `&input=keyboard`. |
| UNO Q / Arduino | Switch to `&dispenser=mock` (animation) or re-run `adb forward`; otherwise hand over a sticker from the crew. Phone still says "Claim confirmed". |
| Supabase Realtime | Nothing to do: 15 s / 30 s polling keeps boards updating. |
| Supabase or Vercel down | Kiosk map keeps working on replay; no signups or claims. Use the backup video. |
| Pinned train left service | Shift+D, re-pin a starred train. |
| Everything | Play the 2-minute backup recording. |
