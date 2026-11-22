# Phone QR → kiosk promo code: presentation runbook

This is the explicit random-coupon demo requested after the camera test passed. It intentionally needs no ranked score, active ride, database, kiosk key or signup to reveal an example promo code. Real ranked claims and camera diagnostics remain separate.

## Present it

1. Keep the local Next server running on the Mac, bound to `0.0.0.0`, port 3001.
2. In Chrome on the Mac, open `http://localhost:3001/kiosk/claim` (or click **Claim your reward** in the kiosk title bar). Allow camera access. Expect **Camera live**.
3. On the phone, open the updated `/mobile` page. Use the deployed site after its deployment finishes, or the Mac's reachable Wi-Fi IP on port 3001. The phone and kiosk may use different origins.
4. Tap **I am Getting off** immediately below **Let's roll** (or Solo Run for an active ride). A random Boston sample coupon and QR appear immediately. There is no eligibility call or countdown.
5. Hold the phone QR to the laptop camera. The kiosk stops the stream and shows **Here's your promo code**, the matching discount/business and a large `BOS-…` example promo code.
6. Use **Scan another QR** to reset the kiosk and reopen the camera. The same QR always reveals the same promo code. Close the phone's pass and tap the button again to draw another random coupon.

## Camera backup

On the phone's QR card, expand **Camera backup · copy QR data**. Copy the `CBD1:…` data. On the kiosk, paste that into the camera-backup field and click **Check code**. This runs the identical coupon decoder, so the same offer and promo code appear.

## Boundaries

- `CBD1:<known offer key>:<eight uppercase hexadecimal digits>` encodes only an example offer and a random demo id. Parsing accepts only the three known offers and that exact bounded format. It never trusts arbitrary merchant names, markup or URLs from a QR.
- Promo codes are deterministic from that public payload; phone and local kiosk need no shared session or backend connection. No clock/expiry can interrupt this demo.
- Demo coupons are clearly labelled examples, not merchant-approved or redeemable discounts. They do not write real awards, consume a ranked claim, end a server ride, affect standings or trigger physical dispensing.
- `CB1:<code>` remains the real ranked claim flow, with its existing backend authorization/expiry/device acknowledgement. `CB-CAMERA-CHECK` remains a camera-only diagnostic. Tests ensure these payload types cannot enter each other's callbacks.
- The old ranked ride-ending control is retained under **Ranked ride options**, so the presentation's primary button is unambiguous.

No new dependencies, environment variables, database migrations or shared contract changes.
