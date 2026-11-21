# UNO Q onboard LED test

No external hardware required. `unoq_blink.ino` toggles `LED_BUILTIN`
once per second without a blocking delay. This tests the UNO Q's STM32
microcontroller; it is not dispenser firmware.

## Verified on Jeet's board

- USB name: Arduino UNO Q.
- USB serial: `3454450778`.
- Current Mac port: `/dev/cu.usbmodem34544507782` (may change).
- Mac core: `arduino:zephyr@1.1.0`.
- Required library: `Arduino_RouterBridge@0.4.1` and its dependencies.
- Compilation and upload succeeded. Jeet confirmed the red LED blinks.
- The Mac serial monitor opened, but no test messages were observed.
  Serial communication is not yet verified.
- The board's Linux-side Arduino installation reports core `0.52.0`.
  Its `arduino-router` service is active. Check Linux/runtime compatibility
  before relying on the newer host library's serial/Bridge behavior.

## Commands from the repository root

On this Mac, the CLI is bundled in Arduino IDE, rather than on PATH:

```sh
ARDUINO_CLI='/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli'
"$ARDUINO_CLI" core update-index
"$ARDUINO_CLI" core install arduino:zephyr@1.1.0
"$ARDUINO_CLI" lib install Arduino_RouterBridge@0.4.1
"$ARDUINO_CLI" board list
"$ARDUINO_CLI" compile --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 firmware/unoq_blink
"$ARDUINO_CLI" upload --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 firmware/unoq_blink
"$ARDUINO_CLI" monitor --port /dev/cu.usbmodem34544507782 --config baudrate=115200
```

Close the serial monitor with Ctrl+C before opening the port elsewhere.
Use `arduino:zephyr:unoq` for this board; the classic Uno's
`arduino:avr:uno` commands in the dispenser plan do not apply.

Uploading replaces the current MCU sketch. The onboard Linux OS is not
reimaged by this test.
