# Constant Buffers

BostonHacks 2026: a smart kiosk for MBTA train cars. Riders see every train on the T live, scan a QR to play a runner game on their own phone, compete on the car and daily leaderboards, and the car champion wins a sticker from an Arduino dispenser when they get off.

**Live:** https://constant-buffers.vercel.app · **Repo docs:** [CLAUDE.md](CLAUDE.md) (ownership, conventions, gotchas) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (source of truth: stack, data model, API, protocols, roadmap)

---

## Status (Nov 21, 2026)

| Area | Status |
|---|---|
| Infra: Vercel + Supabase + MBTA key | ✅ Live. Pushes to `main` auto-deploy. `/api/health` reports every backend `ok` |
| Database (Supabase Postgres) | ✅ `0001_init` + `0002_secure_views` applied; 0 riders (test data removed) |
| API (every endpoint in ARCHITECTURE §4) | ✅ Built and tested end to end against the real database |
| Phone app (`/play`, `/play/run`) | ✅ Built and tested in a phone-sized browser |
| Kiosk (`/kiosk/[carId]`) | ✅ Built and tested with the mock and (fake) HTTP dispensers |
| Website (`/`, `/leaderboard`) | ✅ Live map + daily board |
| Map data (`stations.json`, `layout.json`) | ✅ Generated from MBTA (118 stations) |
| Game (`@cb/game`) | ✅ Jeet's real seeded three-lane runner (swipe controls) is merged behind `createRunner` |
| Dispenser hardware | 🟡 Jeet's Arduino **UNO Q** lights an LED over HTTP (`led-only`). Sticker mechanism not built yet |
| Replay fallback | ✅ `demo.json` is a real 30 min / about 1.1 MB recording (`scripts/trim-replay.ts`); `?feed=replay` and the auto-fallback show 70+ trains |
| Kiosk polish | ✅ Transfer card loading/empty/data states, dispenser status chip, bigger kiosk map variant, claim-code boxes, new-rider toast, ticker fix, Shift+D pin list with station names |
| Phone and website polish | ✅ Lobby refresh after a run, name kept on re-signup plus name blocklist, how-to-play, leaderboard day navigation |
| Docs | ✅ [docs/DEMO.md](docs/DEMO.md): demo script, judging URLs, checklist, fallback drill |
| Not yet tested on real hardware | ⚪ webcam QR scan, UNO Q board, Web Serial Arduino, real iPhone/Android, Supabase Realtime delivery |

---

## What's built

### Backend (`apps/web/app/api`, `apps/web/lib`)
- **Rider sessions:** signed httpOnly cookies (`jose`): `cb_rider` (30 days) and `cb_ride` (90 min). Name + phone signup, no OTP (demo-grade, see §7).
- **Joining a car:** the kiosk QR carries a join token that rotates every 30 s and is valid for at most 60 s (HMAC, `lib/tokens.ts`). Rejoining the same car keeps the ride; joining another ends the old one.
- **Runs and anti-cheat** (`lib/score.ts`, unit-tested): owner and active-ride checks, duration ≥ 3 s and ≤ server time + 2 s, score ≤ 70/s × 1.1 + 50, coins ≤ score, run ≤ 10 min old, finish once (atomic). Rejected runs are stored with a reason.
- **Getting off:** always ends the ride. The leader (ties go to whoever scored first) gets a 6-character claim code valid for 2 minutes; otherwise `not_leader` / `no_score` / `already_claimed_today` (one sticker per rider per day).
- **Kiosk endpoints** (need `x-kiosk-key`): join token, car state (top 5, riders aboard, pending claim), pin vehicle, redeem claim (atomic, reasons `invalid` / `expired` / `wrong_car` / `used`), report dispense result.
- **MBTA:** `/api/trains` (one upstream call shared by everyone, cached 5 s, serves stale data up to 60 s on failure), `/api/transfers` (next stops + "next Red at Park St leaves N min after you arrive", cached 15 s).
- **Leaderboards:** car board and daily board (Boston time) from SQL views. Since `0002` the views run as the caller and are revoked from public roles, so only the server can read them.
- **Realtime:** Supabase Broadcast "changed" pings sent with `httpSend`. They are only hints: clients always refetch, and 15 s / 30 s polling covers any drop.
- **Rate limits:** signup 5/min/IP, join 10/min/rider, start run 1 per 3 s, redeem 10/min/kiosk.
- **Device proxy** `/api/device/status|reward`: forwards to Jeet's UNO Q at `UNOQ_URL` (default `127.0.0.1:8765`). Needs the kiosk key outside `next dev`.
- **Health:** `/api/health` reports which backends are reachable, never secrets.

### Phone (`/play`, `/play/run`)
QR landing → sign up → auto-join → lobby (best score, car rank, car board) → full-screen game (scroll locked for iOS) → result card with the car board → **I'm getting off** (tap twice) → winner gets a big claim QR (`CB1:<code>`) plus the typed code, a 2-min countdown and live status (pending / redeemed / expired).

### Kiosk (`/kiosk/green-3812?key=…`)
- **Left 62%:** Spider-Tracker map with glowing line colors and live trains that move smoothly between snapshots; the pinned train is a pulsing **YOU**.
- **Right 38%:** car header and riders aboard, next stop + transfer card, car top 5, rotating join QR with a 30 s ring.
- **Bottom:** scrolling daily ticker.
- **Winner flow:** winner overlay → webcam QR scan (only `CB1:` codes) or typed code on the keyboard → redeem → dispense → "Enjoy your sticker" (or, for an LED-only board, "Reward light on, grab your sticker from the crew").
- **Shift+D status panel** (plain `D` is a claim-code letter): server health, live/replay switch, dispenser connect/test/ping, realtime hint count, redeem a code by hand, pin this kiosk's train.
- **Fallbacks:** live feed drops to replay after 3 failures; the keyboard always works next to the webcam; mock dispenser.

### Adapters (`apps/web/lib/adapters`)
| Adapter | Implementations (flag) |
|---|---|
| `Dispenser` | `serial` Web Serial protocol v1 (READY handshake, PING heartbeat, DISPENSE with ACK/DONE/ERR, 4 s timeout, 1 retry, auto-reconnect) · `http` Arduino UNO Q (§5.1) · `mock` (1.5 s) |
| `RiderInput` | `webcam` (qr-scanner, `CB1:` only) · `keyboard` (always on) |
| `TrainFeed` | `live` (polls `/api/trains` every 10 s) · `replay` (loops a recorded file from `/replay/`) |

### Shared contracts (`packages/shared`)
zod schemas for every endpoint (`api.ts`), serial protocol v1 + `parseLine()` (`serial-protocol.ts`), `GAME` rules + `MAX_SCORE_PER_SEC = 70` (`game-rules.ts`), MBTA routes/colors/transfer stations (`lines.ts`), and the generated schematic (`schematic/`).

### Scripts (`scripts/`)
| Script | What |
|---|---|
| `record-mbta.ts --minutes 60` | Records live snapshots every 10 s into `apps/web/public/replay/<date>.json` (raw responses go to gitignored `recordings/`) |
| `build-stations.ts [--layout]` | Station order per route/direction from MBTA canonical patterns, plus a generated fisheye layout (regenerate only with `--layout`) |
| `trim-replay.ts --in <raw> --minutes 30` | Cuts a raw recording down to `apps/web/public/replay/demo.json` (thinned frames, validated with `ReplayFile`); raw `20*.json` recordings are gitignored |
| `seed-demo.ts [--clear]` | 4 fake riders with beatable scores (480 and below) on `green-3812`; rerun before judging (rides expire after 90 min) |

### Tests
`pnpm test`: 31 tests in all (serial `parseLine`/commands, join tokens and claim codes, train placement and MBTA parsing, score validation).

---

## Run it

Requires Node 26 (`.nvmrc`) and pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in; /dev/game and /dev/dispenser need nothing
pnpm dev                              # http://localhost:3000
```

Phones on the same Wi-Fi: `pnpm dev --hostname 0.0.0.0`, then `http://<mac-ip>:3000`.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

### Kiosk on the MacBook (needed for the UNO Q)
The board is only reachable from the kiosk Mac, so the kiosk runs there; phones still use the Vercel site (same database and secrets).

```bash
UNOQ_ADB="$HOME/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb"
"$UNOQ_ADB" forward tcp:8765 tcp:8765        # then start firmware/unoq_web/server.py on the board (Jeet's README)
pnpm kiosk                                   # prod build on :3000
# open http://localhost:3000/kiosk/green-3812?key=<KIOSK_SECRET>&dispenser=http, Shift+D should say "Dispenser (http): ready"
```

### Local env files (all gitignored)
| File | Purpose |
|---|---|
| `apps/web/.env.local` | All secrets (see `.env.example`) |
| `apps/web/.env.development.local` | `KIOSK_SECRET=dev-kiosk-key-local` for `pnpm dev`, keeping the real kiosk key out of local URLs |
| `apps/web/.env.production.local` | For `pnpm kiosk`: `NEXT_PUBLIC_APP_URL=https://constant-buffers.vercel.app` so the QR sends phones to Vercel, plus `UNOQ_URL` |

## Pages
| Path | What |
|---|---|
| `/` | Live map + today's leaders |
| `/leaderboard` | All-MBTA daily leaderboard |
| `/kiosk/green-3812?key=<KIOSK_SECRET>` | Kiosk. `?feed=live\|replay`, `?replay=<file>`, `?dispenser=serial\|http\|mock`, `?input=webcam\|keyboard`, `?vehicle=<id>` |
| `/play?car=green-3812&t=<token>` | Phone entry (from the kiosk QR) |
| `/play/run` | Full-screen game |
| `/dev/dispenser` | Web Serial test panel (Chrome), no env vars |
| `/dev/game` | Game harness, no env vars |

## Deploy and infra
- **Vercel** project `constant-buffers`: root directory `apps/web`, Next.js, Node 24.x, Git-connected (`main` → production). Env vars are set for production and preview.
- **Supabase** project `Boston-Surfers`: Row Level Security on every table with no public policies, so only the server key reads or writes.
- **MBTA V3** API key (1000 req/min), server-only.

## Layout
| Folder | Owner | What |
|---|---|---|
| `apps/web/` | Vivek | Next.js kiosk, phone, website, API |
| `packages/shared/` | Vivek | Contracts, rules, MBTA lines, schematic |
| `packages/game/` | Jeet | Phaser runner behind `createRunner()` |
| `firmware/` | Jeet | Dispenser firmware (UNO Q web server, not pushed yet) |
| `supabase/` | Vivek | SQL migrations |
| `scripts/` | Vivek | Recorder, replay trimmer, station builder, demo seed |

---

## What's left

**Jeet**
- [ ] Push `firmware/unoq_web/` (`server.py`, `index.html`, `verify_live.py`); it isn't in the repo yet.
- [ ] Confirm the HTTP contract in ARCHITECTURE §5.1 (contract changes need both owners).
- [ ] Build the sticker mechanism (the board is LED-only today).
- [ ] Game HUD hard-codes "NEXT STOP / PARK STREET" (`RunnerScene.ts`): needs an additive `theme.nextStop` option in `createRunner` (contract change, both owners).
- [ ] In mobile emulation, tapping the in-canvas START RUN did nothing (Enter worked): verify on a real iPhone and Android.
- [ ] Canvas is a fixed 390x844, so wider phones are letterboxed.
- [ ] `firmware/dispenser/` is empty (no Uno serial sketch; only needed for the `serial` path).

**Vivek**
- [ ] Test with real hardware: webcam QR scan from a phone screen, the UNO Q via `pnpm kiosk`, iPhone + Android on cellular.
- [ ] Check that Supabase Realtime events arrive (the Shift+D panel counts them).
- [ ] Before judging: re-pin the kiosk's train (Shift+D) and rerun `seed-demo`.
- [ ] Record the backup video (script and fallback drill are in `docs/DEMO.md`).
- [ ] Optional polish: hand-tune `layout.json`. Known glitch: northbound Braintree-branch trains at JFK are drawn coming from Savin Hill.

## Known quirks
- After closing the Shift+D panel in the test browser, typed claim codes were ignored until the page was clicked once. Click the kiosk screen if that happens.
- MBTA has no service roughly 1–5 AM: use `?feed=replay`.
- Web Serial and the webcam need Chrome on HTTPS or localhost; only one program can hold the serial port.
