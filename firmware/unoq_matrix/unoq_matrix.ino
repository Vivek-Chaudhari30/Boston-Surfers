#include <Arduino_LED_Matrix.h>
#include <Arduino_RouterBridge.h>

Arduino_LED_Matrix matrix;
uint8_t pixels[104] = {};
volatile bool active = false;
volatile int activeId = 0;
volatile int completedId = 0;
volatile int completedCount = 0;
volatile unsigned long startedAt = 0;
int lastFrame = -1;
constexpr int FRAME_MS = 80;
constexpr int FRAMES = 36;

int startWin(int id) {
  if (id <= 0) return -1;
  if (id == completedId) return 2;
  if (active) return activeId == id ? 1 : 0;
  activeId = id;
  startedAt = millis();
  lastFrame = -1;
  active = true;
  return 1;
}
int matrixStatus(int field) {
  if (field == 0) return 20261121;
  if (field == 1) return active ? 1 : 0;
  if (field == 2) return completedId;
  if (field == 3) return completedCount;
  return -1;
}
void dot(int x, int y) {
  if (x >= 0 && x < 13 && y >= 0 && y < 8) pixels[y * 13 + x] = 1;
}
void render(int frame) {
  memset(pixels, 0, sizeof(pixels));
  if (frame < 8) {
    const int r = frame % 4;
    dot(6, 3);
    for (int i = 1; i <= r; i++) {
      dot(6 + i, 3); dot(6 - i, 3); dot(6, 3 + i); dot(6, 3 - i);
      dot(6 + i, 3 + i); dot(6 - i, 3 - i); dot(6 + i, 3 - i); dot(6 - i, 3 + i);
    }
  } else if (frame < 16) {
    const uint16_t trophy[8] = {0x1FC, 0x104, 0x38E, 0x28A, 0xF8, 0x20, 0x70, 0xF8};
    if (frame % 4 != 3) for (int y = 0; y < 8; y++) for (int x = 0; x < 13; x++) if (trophy[y] & (1 << (12 - x))) dot(x, y);
  } else if (frame < 28) {
    const uint8_t letters[3][5] = {{5,5,5,7,5}, {7,2,2,2,7}, {5,7,7,7,5}};
    if (frame % 4 != 3) for (int l = 0; l < 3; l++) for (int y = 0; y < 5; y++) for (int x = 0; x < 3; x++) if (letters[l][y] & (1 << (2 - x))) dot(1 + l * 4 + x, y + 1);
  } else {
    const uint8_t check[][2] = {{2,4},{3,5},{4,6},{5,5},{6,4},{7,3},{8,2},{9,1},{10,0}};
    for (const auto& p : check) dot(p[0], p[1]);
  }
  matrix.draw(pixels);
}
void setup() {
  matrix.begin();
  matrix.setGrayscaleBits(1);
  matrix.clear();
  Bridge.begin();
  Bridge.provide("cb_matrix_start", startWin);
  Bridge.provide("cb_matrix_status", matrixStatus);
}
void loop() {
  if (active) {
    int frame = (millis() - startedAt) / FRAME_MS;
    if (frame >= FRAMES) {
      matrix.clear();
      completedId = activeId;
      completedCount++;
      active = false;
    } else if (frame != lastFrame) {
      lastFrame = frame;
      render(frame);
    }
  }
  delay(2);
}
