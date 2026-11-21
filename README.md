# Constant Buffers

BostonHacks 2026: a smart kiosk for MBTA train cars with a live train map, a phone runner game, leaderboards, and an Arduino sticker dispenser.

- [CLAUDE.md](CLAUDE.md): conventions, ownership, commands
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): source of truth (stack, data model, API, serial protocol, roadmap)

## Layout (scaffold in progress)

| Folder | Owner |
|---|---|
| `apps/web/` | Vivek: kiosk, phone, website, API |
| `packages/shared/` | Vivek: shared contracts (types, zod, serial protocol, game rules) |
| `packages/game/` | Jeet: Phaser runner (`@cb/game`) |
| `firmware/` | Jeet: Arduino Uno dispenser |
| `supabase/`, `scripts/` | Vivek |

The full pnpm workspace, contracts and stubs land in the next commit.
