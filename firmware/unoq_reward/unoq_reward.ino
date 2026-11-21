#include <Arduino_LED_Matrix.h>
#include <Arduino_RouterBridge.h>

// LED-ONLY reward demonstration. No servo, sensor, button, or sticker delivery.
// Uses the existing kiosk protocol so /dev/dispenser can drive the real board.
// DONE confirms the light animation only. Do not use this to confirm a physical prize.
constexpr unsigned long REWARD_MS = 1200;
constexpr unsigned long RETRY_MONITOR_MS = 1000;
constexpr size_t MAX_LINE = 32;
Arduino_LED_Matrix matrix;
uint8_t pixels[104] = {};
char line[MAX_LINE + 1] = {};
size_t lineLength = 0;
bool overflowed = false;
bool busy = false;
char activeId[13] = {};
char lastId[13] = {};
unsigned long rewardStartedAt = 0;
unsigned long retryAt = 0;
uint32_t rewardCount = 0;

bool validId(const char* id) {
  const size_t length = strlen(id);
  if (length == 0 || length > 12) return false;
  for (size_t i = 0; i < length; ++i) {
    const char c = id[i];
    if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
          (c >= '0' && c <= '9'))) return false;
  }
  return true;
}

void reply(const char* kind, const char* id) {
  Monitor.print(kind);
  Monitor.print(' ');
  Monitor.println(id);
}

void showCheckmark(bool on) {
  memset(pixels, 0, sizeof(pixels));
  if (on) {
    const uint8_t points[][2] = {{3, 4}, {4, 5}, {5, 6}, {6, 5},
                                {7, 4}, {8, 3}, {9, 2}, {10, 1}};
    for (const auto& point : points) pixels[point[1] * 13 + point[0]] = 1;
  }
  matrix.draw(pixels);
}

void handleCommand(const char* command) {
  if (strcmp(command, "PING") == 0) {
    Monitor.println("PONG");
  } else if (strcmp(command, "STATUS") == 0) {
    if (busy) {
      Monitor.println("STATUS busy");
    } else {
      Monitor.print("STATUS idle count=");
      Monitor.println(rewardCount);
    }
  } else if (strncmp(command, "DISPENSE ", 9) == 0 && validId(command + 9)) {
    const char* id = command + 9;
    if (busy) {
      Monitor.print("ERR ");
      Monitor.print(id);
      Monitor.println(" BUSY");
    } else if (strcmp(id, lastId) == 0) {
      reply("DONE", id); // Idempotent retry: no extra animation or count.
    } else {
      strcpy(activeId, id);
      busy = true;
      rewardStartedAt = millis();
      showCheckmark(true);
      reply("ACK", id);
    }
  } else if (strncmp(command, "SERVO ", 6) == 0) {
    Monitor.println("ERR - NOHARDWARE");
  } else {
    Monitor.println("ERR - BADCMD");
  }
}

void setup() {
  matrix.begin();
  matrix.setGrayscaleBits(1);
  matrix.clear();
  // On the original UNO Q runtime, USB serial is routed through Monitor.
  // Serial is the MCU UART on that core and does not reach the Mac USB port.
  Bridge.begin();
  if (Monitor.begin()) Monitor.println("READY cb-dispenser v1");
}

void loop() {
  const unsigned long now = millis();
  if (!Monitor) {
    if (now - retryAt >= RETRY_MONITOR_MS) {
      retryAt = now;
      if (Monitor.begin()) Monitor.println("READY cb-dispenser v1");
    }
    return;
  }

  // Bound work per iteration so continuous input cannot starve the animation.
  for (uint8_t readCount = 0; readCount < 64 && Monitor.available(); ++readCount) {
    const char c = static_cast<char>(Monitor.read());
    if (c == '\r') continue;
    if (c == '\n') {
      line[lineLength] = '\0';
      if (overflowed) Monitor.println("ERR - BADCMD");
      else handleCommand(line);
      lineLength = 0;
      overflowed = false;
    } else if (c < 32 || c > 126) {
      overflowed = true;
    } else if (lineLength < MAX_LINE && !overflowed) {
      line[lineLength++] = c;
    } else {
      overflowed = true;
    }
  }

  if (busy && millis() - rewardStartedAt >= REWARD_MS) {
    showCheckmark(false);
    strcpy(lastId, activeId);
    ++rewardCount;
    busy = false;
    reply("DONE", lastId);
  }
}
