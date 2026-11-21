# UNO Q LED reward demo

**Experimental, not the active demo.** USB PING did not succeed on this
board, including with a board-native build. The MCU has been returned to
`unoq_idle`. Use the working board-hosted HTTP LED panel in
[`../unoq_web/`](../unoq_web/README.md) instead. No serial test cycles passed.
The build/upload steps below are diagnostic work, not a verified integration.

This is a **hardware-connected LED simulation**, not a sticker dispenser.
It uses the existing kiosk command strings, so no web or shared contract
files need changing. `DONE` confirms a 1.2 second checkmark animation only.
Use the development panel for testing; do not record physical prize
delivery from this LED-only firmware.

The matrix stays blank when idle. `DISPENSE <id>` shows a checkmark,
responds `ACK <id>`, clears the display, and responds `DONE <id>`.
Repeating the last completed ID replies `DONE` without another animation
or count increment. Other IDs received while busy get `ERR <id> BUSY`.
PING and STATUS remain available during the animation.

There is no servo, external button, or drop sensor. `SERVO` returns
`ERR - NOHARDWARE`. Malformed, oversized, and unknown commands return
`ERR - BADCMD`. Counts and the last successful ID are held in RAM and
reset after a firmware restart. This implements a subset of the physical
dispenser contract; it is deliberately kept separate from its future sketch.

## Known setup

- UNO Q, USB serial `3454450778`, Mac port `/dev/cu.usbmodem34544507782`.
- Host core `arduino:zephyr@1.1.0`.
- `Arduino_RouterBridge@0.4.1`, `Arduino_RPClite@0.2.1`.
- The board's Linux router is `0.5.3`; its preinstalled CLI core is `0.52.0`.
- Use the new host uploader. The old 0.52.0 uploader timed out when writing
  flash. Do not downgrade the MCU loader with the old uploader.
- USB messages use RouterBridge `Monitor`, forwarded by the board's
  existing `arduino-router-serial` service. The board does not reset when
  the Mac opens its port; the existing web adapter has a PING fallback.

## Build and upload

These host-build commands compile, but did not establish working USB
communication. `deploy.py --serial 3454450778` performs the alternative
board-native 0.52.0 build and uses `flash_legacy.cfg` with the newer uploader;
that route also uploaded but did not answer PING. Neither should replace
the active HTTP demo without further diagnosis.

Close any serial monitor or connected browser panel first.

```sh
ARDUINO_CLI='/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli'
"$ARDUINO_CLI" compile --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 firmware/unoq_reward
"$ARDUINO_CLI" upload --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 --upload-property upload.port.properties.serialNumber=3454450778 firmware/unoq_reward
```

The explicit USB serial number handles missing port properties during
discovery. Update the port/serial if using a different board.

## Hardware protocol verification

With the browser disconnected:

```sh
python3 firmware/unoq_reward/test_serial.py --port /dev/cu.usbmodem34544507782 --cycles 20
```

This exercises the actual board: handshake, unknown input, overlong input
and recovery, invalid IDs, missing servo, BUSY, PING/STATUS while busy,
ACK/DONE, duplicate IDs, and the completion counter. It requires no Python
dependencies. It closes the serial port when finished.

## Browser demonstration

1. Run the Next.js development server.
2. Open `http://localhost:3000/dev/dispenser` in desktop Chrome.
3. Click **Connect** and select the UNO Q USB serial port.
4. Wait for **ready** (allow about four seconds for the PING fallback).
5. Click **PING**; look for `PONG` in the log.
6. Click **DISPENSE (random id)**; watch the physical checkmark and the
   corresponding ACK/DONE lines.
7. Click **Repeat last id**; DONE should return without another checkmark.
8. Click **STATUS** to inspect the animation count.
9. Click **Disconnect** before using a terminal monitor or uploading.

The browser's SERVO control has no physical effect on this setup.
This development demonstration does not require Supabase or `.env` files.
