#include <Arduino_LED_Matrix.h>

// Display A through E on UNO Q's built-in 8 x 13 blue LED matrix.
// No serial connection, network, or external hardware is needed at runtime.
Arduino_LED_Matrix matrix;
constexpr unsigned long LETTER_MS = 2000;
constexpr unsigned long GAP_MS = 300;
constexpr uint8_t GLYPHS[5][7] = {
  {0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001}, // A
  {0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110}, // B
  {0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111}, // C
  {0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110}, // D
  {0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111}, // E
};
uint8_t pixels[104] = {};
uint8_t letter = 0;
bool showing = true;
unsigned long changedAt = 0;

void showLetter(uint8_t index) {
  memset(pixels, 0, sizeof(pixels));
  for (uint8_t y = 0; y < 7; ++y) {
    for (uint8_t x = 0; x < 5; ++x) {
      pixels[y * 13 + x + 4] = (GLYPHS[index][y] >> (4 - x)) & 1;
    }
  }
  matrix.draw(pixels);
}

void setup() {
  matrix.begin();
  matrix.setGrayscaleBits(1);
  showLetter(letter);
  changedAt = millis();
}

void loop() {
  const unsigned long now = millis();
  if (now - changedAt < (showing ? LETTER_MS : GAP_MS)) return;
  changedAt = now;
  if (showing) {
    matrix.clear();
  } else {
    letter = (letter + 1) % 5;
    showLetter(letter);
  }
  showing = !showing;
}
