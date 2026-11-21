# UNO Q: A to E physical demonstration

Displays A, B, C, D, E on the onboard blue 8 x 13 LED matrix in a
continuous loop. Each letter stays visible for two seconds, separated
by a 300 ms blank interval. No external parts or runtime serial/network
connection is required. Uses the Arduino_LED_Matrix library bundled
with the official UNO Q core.

From the repository root, using the CLI bundled with Arduino IDE:

```sh
ARDUINO_CLI='/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli'
"$ARDUINO_CLI" compile --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 firmware/unoq_letters
"$ARDUINO_CLI" upload --fqbn arduino:zephyr:unoq --port /dev/cu.usbmodem34544507782 firmware/unoq_letters
```

The port may change; check `board list`. Uploading replaces the previous
MCU blink sketch. This is a physical display test, not a website check-in
or a dispenser simulation.
