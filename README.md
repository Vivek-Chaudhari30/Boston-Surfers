# Constant Buffers

BostonHacks 2026: a smart kiosk for MBTA train cars with a live train map, a runner game riders play on their phones, car and daily leaderboards, and an Arduino sticker dispenser.

- **[CLAUDE.md](CLAUDE.md)**: ownership, conventions, commands, gotchas
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: source of truth for the stack, data model, API, serial protocol and roadmap

## Setup

Requires Node 26 (see `.nvmrc`) and pnpm 10.

```bash
nvm use
corepack enable
pnpm install
cp .env.example apps/web/.env.local   # fill in what you have; /dev/* pages need nothing
pnpm dev                              # http://localhost:3000
```

Phones on the same Wi-Fi: `pnpm dev --hostname 0.0.0.0`, then open `http://<mac-ip>:3000`.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm build
pnpm tsx scripts/record-mbta.ts --minutes 60   # record MBTA data for ?feed=replay
```

## Pages

| Path | What |
|---|---|
| `/` | Website: live map + daily leaderboard |
| `/leaderboard` | All-MBTA daily leaderboard |
| `/kiosk/green-3812?key=<KIOSK_SECRET>` | Kiosk. Flags: `?feed=live\|replay`, `?dispenser=serial\|mock`, `?input=webcam\|keyboard`, `?vehicle=<id>` |
| `/play?car=green-3812&t=<token>` | Phone entry point (from the kiosk QR) |
| `/play/run` | Full-screen game |
| `/dev/dispenser` | Web Serial test panel (Chrome). No env vars |
| `/dev/game` | Game harness. No env vars |

## Layout

| Folder | Owner | What |
|---|---|---|
| `apps/web/` | Vivek | `@cb/web`: Next.js kiosk, phone, website, API |
| `packages/shared/` | Vivek | `@cb/shared`: zod API contracts, serial protocol, game rules, MBTA lines, schematic |
| `packages/game/` | Jeet | `@cb/game`: Phaser runner behind `createRunner()` |
| `firmware/` | Jeet | Arduino Uno dispenser |
| `supabase/` | Vivek | SQL migrations |
| `scripts/` | Vivek | MBTA recorder, station builder, demo seed |

## Deploy

Vercel project with root directory `apps/web`; Supabase cloud for Postgres + Realtime. See the env var list in `.env.example`.
