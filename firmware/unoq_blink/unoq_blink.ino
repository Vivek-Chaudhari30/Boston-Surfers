// UNO Q onboard LED smoke test. No external components required.
// This is separate from the dispenser firmware and does not move a servo.
constexpr unsigned long BLINK_INTERVAL_MS = 1000;
unsigned long lastBlinkAt = 0;
bool ledOn = false;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastBlinkAt >= BLINK_INTERVAL_MS) {
    lastBlinkAt = now;
    ledOn = !ledOn;
    digitalWrite(LED_BUILTIN, ledOn ? HIGH : LOW);
    Serial.println(ledOn ? "UNOQ LED HIGH" : "UNOQ LED LOW");
  }
}
