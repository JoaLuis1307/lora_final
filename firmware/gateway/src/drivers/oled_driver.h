#ifndef OLED_DRIVER_H
#define OLED_DRIVER_H

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

extern Adafruit_SSD1306 display;

void oled_init();
void oled_clear();
void oled_print(int x, int y, const char* text);
void oled_println(int x, int y, const char* text);
void oled_line(int x0, int y0, int x1, int y1);
void oled_render();

#endif
