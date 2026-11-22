# Separate kiosk and passenger surfaces

- `/` redirects to `/kiosk`.
- `/kiosk`: fixed laptop viewport, no document/panel scrolling, city map, live daily leaderboard, passenger QR. No game launch control. Navigation leads to Rewards.
- `/kiosk/rewards`: public station-based coupon catalogue. Defaults to BU Central Station. Hynes Convention Center and Harvard Station also have buttons. Three or fewer offers fit one screen.
- `/mobile`: personal passenger home. Bottom navigation: Play, My winnings, History, Profile. No public leaderboard or city map.
- `/mobile/game`: full-screen runner. An authenticated active car ride creates and submits a ranked server run; otherwise practice is stored only in this phone browser. Immediate personal results show score, coins, distance, replay, history and winnings links.
- `/mobile/history`: latest 50 ranked runs for the signed-cookie rider, plus latest 50 local practice runs.
- `/mobile/rewards`: only that rider's database claims, plus separate demo quest unlocks derived from their own scores. Existing claim expiry/redemption rules apply.
- `/mobile/profile`: existing rider signup/session APIs. Production account sync requires HTTPS because rider cookies are Secure. The existing name/phone sign-in is a hackathon identity mechanism, not verified phone ownership; add OTP before public launch involving valuable private rewards.

`GET /api/mobile/history` derives identity only from the signed cookie, filters both runs and claims by that identity, returns 401 without a session, and sends `Cache-Control: private, no-store` and `Vary: Cookie`. No client-supplied rider id, database schema changes, or shared contract changes.

Public and rotating car QR links land under `/mobile`. The public QR has no car token; ranked play still requires a valid car join QR. Existing `/kiosk/[carId]` hardware/claim functionality and legacy `/play` routes remain supported.

## Local rewards data

Real business addresses checked against business websites and Boston University sources on November 21, 2026. Google Maps search links locate businesses; Maps is not an offer feed. No Places API key or added dependency. Sources are stored in `apps/web/lib/reward-catalog.ts` and linked from each card.

Every discount and score threshold is a proposed demo offer, not an actual promotion, partnership, live inventory or redeemable coupon. Demo unlocks are personal progress only and never authorize dispensing. Replace proposed offers with partner-approved terms and server-issued entitlements before live merchant redemption.

## Demo

Bind the local preview to `0.0.0.0`. QR substitutes the Mac's LAN IPv4 for localhost. Phones need the same reachable network; venue client isolation may block it. Practice and catalogue work without Supabase. Daily standings, ranked history and real claims require the backend. Private pages show sync failure rather than invented scores or winnings.
