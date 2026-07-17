#include "oled_driver.h"
#include "../../config.h"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void oled_init() {
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("Fallo OLED");
    return;
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();
}

void oled_clear() { display.clearDisplay(); }

void oled_print(int x, int y, const char* text) {
  display.setCursor(x, y);
  display.print(text);
}

void oled_println(int x, int y, const char* text) {
  display.setCursor(x, y);
  display.println(text);
}

void oled_line(int x0, int y0, int x1, int y1) {
  display.drawLine(x0, y0, x1, y1, SSD1306_WHITE);
}

void oled_render() { display.display(); }
