# Working UNO Q web-to-LED demonstration

The UNO Q hosts a dependency-free Python HTTP server. The Mac forwards
`localhost:8765` over USB using Arduino's ADB tool. The panel's reward button
turns the board's **Linux-side green user LED** on for 1.2 seconds, then off.
The small MCU LED matrix remains blank (`unoq_idle`). No additional parts,
Wi-Fi, administrator password, database, or `.env` file is required.

This is a hardware integration proof. It does not dispense a sticker, read
a card, award traveller points, or implement the main Next.js kiosk flow.
It deliberately stays inside `firmware/`; no Vivek-owned app/shared files
were edited. The serial/MCU Bridge attempt remains unverified and is not
used here.

## Start from the repository root

Requires Python 3 on the board and the Arduino-provided ADB tool on the Mac.
The current board USB serial is `3454450778`.

```sh
UNOQ_ADB="$HOME/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb"
"$UNOQ_ADB" -s 3454450778 shell 'mkdir -p /tmp/cb-unoq-web'
"$UNOQ_ADB" -s 3454450778 push firmware/unoq_web/server.py firmware/unoq_web/index.html /tmp/cb-unoq-web/
"$UNOQ_ADB" -s 3454450778 forward tcp:8765 tcp:8765
"$UNOQ_ADB" -s 3454450778 shell 'python3 /tmp/cb-unoq-web/server.py --port 8765'
```

Keep that terminal running. Open **http://localhost:8765** on your Mac:

1. Confirm the panel says **Connected · Arduino UNO Q**.
2. Click **Trigger reward light** and watch the green user LED on the board.
3. Click **Repeat last reward**. The LED stays off and the count stays the same.

Ctrl+C stops the server and turns the LED off. USB forwarding can be removed
with `"$UNOQ_ADB" -s 3454450778 forward --remove tcp:8765`.
Temporary board files disappear after a reboot; rerun the commands to restore
the demo. Counters and duplicate tracking are session-only and reset on restart.
Only the most recently completed ID is deduplicated, matching the serial demo
contract; use a database for production reward redemption.

## HTTP contract for Vivek's integration

| Request | Result |
| --- | --- |
| `GET /api/status` | Device, LED brightness, busy state, count, last ID |
| `POST /api/reward` with JSON `{ "id": "abc123" }` | `{ "ok": true, "id": "abc123", "duplicate": false, "count": 1, "mode": "led-only" }` after the light finishes |
| Repeat last completed ID | Same success with `duplicate: true`, no extra animation/count |
| Concurrent reward | HTTP 409 with `code: "BUSY"` |
| Invalid ID (not 1–12 ASCII letters/digits) | HTTP 400 |

The server binds to the board's loopback interface. The USB forward makes it
available only through the Mac; this is not a public cloud endpoint. Browser
POSTs are same-origin. For the existing kiosk, Vivek can add a **server-side**
HTTP adapter that calls `http://127.0.0.1:8765/api/reward` while the kiosk runs
on this Mac. That requires changes in Vivek's `apps/web` folder and is not
implemented here. A cloud-hosted Next.js server cannot reach this Mac's
localhost endpoint; a deployed kiosk needs a separately designed transport.
Keep LED-only mode explicit so a light result never confirms physical delivery.

## Verification

```sh
python3 firmware/unoq_web/verify_live.py --cycles 20
```

This checks the live board API, including reading its sysfs LED brightness
while each reward is on and after it turns off, concurrent BUSY rejection,
completion counts, duplicate suppression, and invalid IDs. This verifies
software-visible LED state; visual confirmation still comes from looking at
the physical LED. The browser UI has not been automatically verified because
Chrome automation was unavailable.
