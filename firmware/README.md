# Active LED-matrix demo

Use [unoq_matrix](unoq_matrix/README.md) for the blue winning animation triggered from a kiosk winning QR. It is verified over USB using the native Arduino Router, and the user confirmed the physical animation. The HTTP green-light demo below remains a legacy fallback.

# Firmware: sticker dispenser

## Jeet's actual hardware: UNO Q only

The working hardware demo is now [`unoq_web/`](unoq_web/README.md): a small
HTTP service hosted on the UNO Q that lights its Linux-side green user LED.
It is reachable over USB at `http://localhost:8765` while its server and ADB
forwarding are running. It confirms light animations, not sticker delivery.
All files stay within Jeet's firmware ownership boundary.

The MCU is currently running [`unoq_idle/unoq_idle.ino`](unoq_idle/unoq_idle.ino)
with a blank LED matrix. [`unoq_letters/`](unoq_letters/README.md) is the
previously verified A–E physical display test.

The experimental [`unoq_reward/`](unoq_reward/README.md) serial path uploaded
but did not answer PING on this board. It is not the active integration.

The remaining dispenser plan below assumes a **classic Uno plus additional
parts**, which are not currently available. Its AVR commands do not apply
to the UNO Q.

**Owned by Jeet.** Arduino Uno + SG90 servo + push button. The sketch goes in `firmware/dispenser/dispenser.ino` (not written yet).

## Protocol v1 (summary; full spec in [ARCHITECTURE §5](../docs/ARCHITECTURE.md))

115200 baud, 8N1, ASCII lines ending in `\n` (ignore `\r`), at most 32 chars. The host-side constants live in [`packages/shared/src/serial-protocol.ts`](../packages/shared/src/serial-protocol.ts); the sketch must mirror these strings exactly.

| Host → Arduino | Arduino → Host |
|---|---|
| (port opens, Uno resets) | `READY cb-dispenser v1` (once at boot) |
| `PING` | `PONG` |
| `DISPENSE <id>` (`<id>` = 1–12 `[A-Za-z0-9]`) | `ACK <id>` then `DONE <id>` |
| `DISPENSE <id>` while busy | `ERR <id> BUSY` |
| `DISPENSE <id>` same id as last success | `DONE <id>` (no second drop) |
| (IR sensor fitted, no drop in 1.5 s) | `ERR <id> NODROP` |
| `STATUS` | `STATUS idle count=<n>` or `STATUS busy` |
| `SERVO <deg>` | `OK SERVO <deg>` (calibration) |
| (button on D2 pressed) | `BTN` then `DONE btn` |
| anything else | `ERR - BADCMD` |

Pins: servo D9, button D2 (`INPUT_PULLUP`), LED D13, optional IR break-beam D3. Use a non-blocking `millis()` state machine so `PING`/`STATUS` answer mid-dispense. Power the servo separately (shared ground) or put a 470 µF cap across it.

## Commands

```bash
arduino-cli board list
arduino-cli compile --fqbn arduino:avr:uno firmware/dispenser
arduino-cli upload  --fqbn arduino:avr:uno -p /dev/cu.usbmodemXXXX firmware/dispenser
arduino-cli monitor -p /dev/cu.usbmodemXXXX -c baudrate=115200
```

Test from the browser at `http://localhost:3000/dev/dispenser` (Chrome, no env vars). Close `arduino-cli monitor` first: only one program can hold the port.
