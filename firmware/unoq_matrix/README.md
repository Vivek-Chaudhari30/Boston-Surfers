# UNO Q winning LED-matrix animation

Active USB demo: blue 8 × 13 matrix shows a burst, trophy, WIN and checkmark for 2.88 seconds, then clears. Idle is blank. No external hardware or Python packages.

The MCU sketch exposes `cb_matrix_start(id)` and `cb_matrix_status(field)` through Arduino Router. The board's Python HTTP server calls these over `/var/run/arduino-router.sock`. The Mac reaches that server using Arduino's ADB USB forward on port 8765. No USB serial Monitor is needed.

## Current verified board

USB serial `3454450778`, native core `arduino:zephyr 0.52.0`, Arduino Router `0.5.3`. `deploy.py` builds with the board's installed core and uses the modern Mac remoteocd uploader with the matching legacy sketch address. It replaces the MCU sketch and leaves the matrix blank until triggered.

```sh
python3 firmware/unoq_matrix/deploy.py --serial 3454450778
```

## Start after reconnect/reboot

From the repo root:

```sh
UNOQ_ADB="$HOME/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb"
"$UNOQ_ADB" -s 3454450778 shell 'mkdir -p /tmp/cb-unoq-matrix'
"$UNOQ_ADB" -s 3454450778 push firmware/unoq_matrix/server.py firmware/unoq_matrix/rpc.py /tmp/cb-unoq-matrix/
"$UNOQ_ADB" -s 3454450778 forward tcp:8765 tcp:8765
"$UNOQ_ADB" -s 3454450778 shell 'python3 -u /tmp/cb-unoq-matrix/server.py --port 8765'
```

Keep that terminal open. In another terminal:

```sh
cd apps/web
node node_modules/next/dist/bin/next build
env UNOQ_MATRIX_DEMO=1 node node_modules/next/dist/bin/next start --port 3001 --hostname 127.0.0.1
```

Open **http://localhost:3001/kiosk/claim in real Chrome on the Mac**. Expect **UNO Q LED MATRIX CONNECTED**. The phone can use the deployed website's `/mobile` page.

1. Phone: tap **I am Getting off** below Let's roll.
2. Kiosk: show the winning QR to its camera (use **Scan another QR** after an earlier result).
3. Promo code appears, matrix animation plays, and kiosk reports hardware completion.
4. No animation button is needed: displaying the promo code automatically starts the matrix.

Each deliberate scan gets a new 12-hex request id. Retries of that request keep the same id and don't repeat a completed animation during the bridge process. Completed ids are remembered in server RAM, not across a board reboot. This is a visual demo, not physical coupon dispensing.

`CB-CAMERA-CHECK` is still only a camera diagnostic: it never animates or grants a reward. Use an actual `CBD1:…` winning demo QR.

## HTTP interface

- `GET /api/status`: matrix-only mode, connected/busy/count/lastId.
- `POST /api/reward { id }`: resolves after the MCU acknowledges that animation's completion.
- Duplicate ids return success without replay; concurrent distinct requests return BUSY.

The local web endpoint `/api/demo/matrix` is opt-in with `UNOQ_MATRIX_DEMO=1`, permits loopback hosts and matching browser origins only, validates winning demo QR data, and rejects real ranked claims/diagnostic QR data on this anonymous demo path. The local Next server binds loopback. A cloud server cannot reach the Mac's USB port; the public kiosk instead uses the browser connection below.

## Verification performed

- Native build/upload succeeded; RPC readiness marker `20261121` returned.
- Initial test and three announced replays completed; user confirmed the animation was visible.
- Real Chrome kiosk's winning-code backup triggered the same handler as its QR camera callback. MCU count advanced from 4 to 5 and the kiosk showed **UNO Q LED matrix animation completed**.
- Web tests cover local opt-in, origin/host checks, QR validation, stable retry ids, matrix-only acknowledgements and disconnected USB handling.

## Public Vercel kiosk with USB matrix

Open https://constant-buffers.vercel.app/kiosk/claim in Chrome on the USB-connected Mac.
The kiosk connects automatically. Allow Chrome’s local/loopback network permission if prompted.
The website stays on Vercel; browser requests go directly to the loopback USB bridge
at `127.0.0.1:8765`. Keep the native server and ADB forward running as described above.
Only the exact `https://constant-buffers.vercel.app` origin and same-origin requests
are allowed by the bridge. It is never exposed on the internet.
After a demo winning QR, the promo code appears and the matrix plays; completion
is displayed only after the MCU acknowledges it. This path is for demo animations;
it does not authorize ranked reward redemption.
