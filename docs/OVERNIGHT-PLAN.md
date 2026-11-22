# Overnight plan (2026-11-21), decisions locked with Vivek

Jeet's commits `4576f46` and `4eb4ce5` (kiosk/mobile split) are pulled and merged with local WIP. `/` redirects to `/kiosk`. The TopBar shows Games, Rewards and Map.

## Surfaces
- `/kiosk` is the in-car screen. It keeps Jeet's look: map, daily board, Rewards nav and no play controls. It also gets the rotating car-token QR, the race lobby view and the Arduino exit ping over USB Web Serial (`?dispenser=serial`). `/kiosk/[carId]` stays as an alias.
- `/mobile/*` is the rider's phone. Everything about playing lives here.

## Rider flow
1. The rider scans the rotating QR and lands on `/mobile`.
2. First visit: a name + US 10-digit phone form (no OTP). The device remembers the rider with a cookie and localStorage, so on the next visit they skip straight in. The same phone on a new device maps to the same rider.
3. Live race: every rider who scanned joins the car lobby and gets the same countdown and the same seed. Each phone shows the others' live positions and a podium at the end. The race reuses the existing Car Race code. The runner is used only through `createRunner`, because `packages/game` is Jeet's.
4. Offers and coupons: keep Jeet's `reward-catalog.ts` station offers and the 250/500/750 milestones.
5. The rider presses "I'm leaving the train". If they are #1 in this car's current ride, the server creates a claim. The kiosk is notified through Realtime and refetches from the API, then sends the existing `DISPENSE <claimcode>`. Jeet's firmware shows "collect your voucher". This needs no serial-protocol contract change.

## Database (live Supabase; additive migrations only)
- `riders`: name and phone (exists).
- `runs`: date, time and score of every game (exists).
- New `award_types` table: car_champion, race_podium (1st, 2nd and 3rd), daily_champion, score_milestone.
- New `awards` table: rider, type, ride/run/race, `won_at`, and the claim/voucher link.
- Views/API for profile history: every play (date, time, score), wins and awards by type.
- Seed demo award types plus a little demo history.
- Migrations run through `SUPABASE_DB_URL` in `apps/web/.env.local`, which Vivek adds. If it is missing, write the SQL plus a script, and make the code degrade gracefully.

## Shipping
- Small commits. Before each push, typecheck, lint, test and build must all pass. Use `git pull --rebase`, push to main, and deploy to Vercel prod.
- Don't touch `packages/game` or `firmware/`. List any changes they need in a handoff note for Jeet.
