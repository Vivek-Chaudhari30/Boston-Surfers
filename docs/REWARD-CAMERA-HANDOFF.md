# Reward camera handoff

## Camera-only test: no backend needed

1. Mac: open `http://localhost:3001/kiosk/claim` in Chrome, or tap **Claim your reward** in the kiosk title bar. Allow the camera prompt. Use localhost, not the Mac's LAN IP, for camera access.
2. Phone on the same reachable Wi-Fi: open `http://<mac-ip>:3001/mobile/camera-check`. Hold its QR to the Mac camera. Expected: **Camera check passed**.
3. **Close camera** returns to the map and releases the stream. Permission failures and unsupported embedded previews show Retry. Real claims also have manual six-character code entry.

The camera-check payload `CB-CAMERA-CHECK` is a diagnostic, never a reward claim. It cannot call reward redemption or trigger the Arduino. No camera frames are uploaded or committed.

Chrome on this Mac was verified to detect its FaceTime HD camera, show **Camera live**, and stop recording on Close. A physical scan of the phone-held test QR remains for the user to perform.

## Signed-in ranked reward path

Reuses existing identity, winner eligibility and claims table. No new sign-in, database migration or shared contract change.

1. A signed-in passenger joins an active ranked ride through the existing valid car join QR flow.
2. **I am getting off** calls existing `POST /api/rides/:rideId/end`. Existing winner/minimum-riders/daily-limit rules apply. A ranked winner receives the existing two-minute claim code. Local practice scores never qualify.
3. `/mobile/rewards?claim=<code>` opens the phone reward QR. `POST /api/rewards/claim { code }` checks the signed rider's ownership/state and returns `CB1:<code>` with server-derived reward details. QR is a database reference; client scores and coupon descriptions are never trusted.
4. Kiosk camera calls `POST /api/rewards/redeem { code }` with the existing kiosk key. It finds the car from the database, reuses atomic claim reservation, sends the stable claim id to the native UNO Q adapter, and records completion only after a matching board acknowledgement.
5. Phone polls `GET /api/rewards/:code/status`. Only its signed-in owner can read it. States: pending, processing, hardware_error, complete, expired. Completed claims return `already_complete` with no board call. Hardware errors retry with the same id.

A short ranked winner run gets a Boston keepsake; higher scores select the matching BU Central demo coupon concept. Discounts are illustrative, not merchant-approved. The user chose the easiest existing winner mechanism and explicitly required signed-in ranked claims.

## Vivek's configuration boundary

The running Mac preview reports missing Supabase, SESSION_SECRET and KIOSK_SECRET. Vivek owns backend and sign-in setup. Never put secrets in code or chat. Camera-only testing works now.

The scanner uses the existing `cb:kiosk-key` (from `?key=` or its setup form). Endpoints still require `requireKiosk`; there is no local reward/auth bypass. Vivek’s configured map now shows a rotating car join QR; without a kiosk key it still shows the generic passenger link. A configured car join QR is required for ranked play.

Vivek’s new signup, awards, race and history flow is preserved. `LeaveTrain` now renders the new reward QR component. The native `/kiosk` defaults to HTTP transport, and automatic pending-claim redemption is disabled by default so it cannot consume a claim before the camera scan; the legacy auto-voucher path is explicitly opt-in with `?claimMode=auto`.

The UNO Q native server was reachable on Mac loopback port 8765, in `led-only` mode. Next must run on the Mac with USB/ADB forwarding active; Vercel cannot reach that loopback server. `UNOQ_URL` overrides the board origin. Existing firmware remembers only the most recent id; retries of old unconfirmed claims after other rewards or a board restart need crew reconciliation. No physical dispensing is claimed.

Tests cover camera cancellation/cleanup, diagnostic isolation, unsupported previews, duplicate QR callbacks, reward states, kiosk authorization, missing/expired/used claims, simultaneous scan coalescing, stable retry ids and matching device acknowledgements. Real ranked phone → camera → LED → phone completion verification still depends on backend configuration.
