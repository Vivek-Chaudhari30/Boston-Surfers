#include <Arduino_LED_Matrix.h>

Arduino_LED_Matrix matrix;

void setup() {
  matrix.begin();
  matrix.clear();
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // MCU user LED is active low.
}

void loop() {}
