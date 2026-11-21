# CLAUDE.md

This repo is **Constant Buffers**: a BostonHacks 2026 project with a 24-hour clock. It's a smart kiosk for MBTA train cars with a live train map, a runner game played on riders' phones, car and daily leaderboards, and an Arduino sticker dispenser.

**Read `docs/ARCHITECTURE.md` before any non-trivial change.** It is the source of truth for the stack, data model, API contracts, serial protocol and roadmap.

## Who owns what
| Folder | Owner | Notes |
|---|---|---|
| `apps/web/`, `packages/shared/`, `supabase/`, `scripts/` | Vivek | Kiosk, phone, website, API, DB |
| `firmware/`, `packages/game/` | Jeet | Arduino Uno dispenser; Phaser runner |

Only edit the folders your human owns. If a task needs a change elsewhere, stop and say so.

## Contracts (frozen after hour 1)
These live in `packages/shared/src/`:
- `serial-protocol.ts`: kiosk ↔ Arduino protocol v1. The firmware mirrors these strings exactly.
- `game-rules.ts`: the `GAME` constants and `MAX_SCORE_PER_SEC`, used by both the game and server validation.
- `api.ts`: zod schemas and types for every endpoint in ARCHITECTURE §4.
- The `createRunner` / `RunResult` signature, exported by `@cb/game`.

Changing a contract requires both people to agree. Update the shared file and ARCHITECTURE.md in the same commit.

## Commands
```bash
pnpm install
pnpm dev                     # Next.js on http://localhost:3000
pnpm dev --hostname 0.0.0.0  # so phones on the same Wi-Fi can open http://<mac-ip>:3000
pnpm typecheck && pnpm lint && pnpm test
pnpm build

# record MBTA data for replay (needs MBTA_API_KEY)
pnpm tsx scripts/record-mbta.ts --minutes 60

# firmware (from repo root)
arduino-cli board list
arduino-cli compile --fqbn arduino:avr:uno firmware/dispenser
arduino-cli upload  --fqbn arduino:avr:uno -p /dev/cu.usbmodemXXXX firmware/dispenser
arduino-cli monitor -p /dev/cu.usbmodemXXXX -c baudrate=115200
```

## Useful pages
- `/kiosk/green-3812?key=<KIOSK_SECRET>`: the kiosk. Flags: `?feed=live|replay`, `?dispenser=serial|mock`, `?input=webcam|keyboard`, `?vehicle=<id>`. Press `Shift+D` for the hidden status panel (plain `D` is a claim-code letter). `?replay=<file>` picks a recording from `public/replay/`.
- `/play?car=green-3812&t=<token>`: the phone entry point (reached from the kiosk QR).
- `/dev/dispenser`: Web Serial test panel (Chrome only). Needs no env vars.
- `/dev/game`: game harness. Needs no env vars.

## Conventions
- TypeScript strict. No `any` without a comment explaining why.
- Validate every API input with the zod schema from `@cb/shared`. Errors are `{ error, code }`.
- Hardware and data sources are only reached through the adapters in `apps/web/lib/adapters/` (`Dispenser`, `RiderInput`, `TrainFeed`). Never call `navigator.serial`, the camera, or MBTA from components directly.
- The Supabase service key and `MBTA_API_KEY` are **server-only**. They are never in `NEXT_PUBLIC_*` and never in client components.
- Realtime Broadcast payloads are hints. On any event, refetch from the API; never trust the payload.
- Phaser runs client-only (`next/dynamic`, `ssr: false`). The game package must not import Next or React.
- Keep pure logic (train placement, score validation, tokens) in plain functions with Vitest tests.
- Every external dependency needs a working fallback flag. The demo must survive Wi-Fi, MBTA, camera or Arduino failure.
- UI style: dark "Spider-Tracker" HUD, MBTA line colors from `@cb/shared/lines.ts`, minimal and clean, with large type on the kiosk.

## Workflow
- Make small commits with clear messages (`feat(kiosk): rotating join QR`). Run `git pull --rebase` before every push. Push often.
- Run `pnpm typecheck` before committing. Run `pnpm build` before anything you'd demo.
- Don't add dependencies beyond those in ARCHITECTURE §1 without asking.
- Don't start nice-to-haves (ARCHITECTURE §0) before H18.
- Never commit `.env*` (except `.env.example`) or secrets.

## Gotchas
- **Arduino Uno resets when the serial port opens.** Wait for `READY` before sending anything.
- **Only one program can hold the serial port.** Close the Arduino IDE or the `arduino-cli monitor` before using `/dev/dispenser`.
- **Web Serial** works only in Chrome/Edge, needs a user click for the first connection, and needs HTTPS or localhost.
- **iOS Safari:** set `touch-action: none` on the game canvas and lock page scroll, or swipes scroll the page.
- **MBTA:** no service roughly 1–5 AM, so use `?feed=replay` for overnight work. Vehicle stops are usually platform ids; map them to the parent station.
