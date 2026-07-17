#ifndef NODE_APP_H
#define NODE_APP_H

#include <Arduino.h>

enum NodeMode {
  MODE_NORMAL,
  MODE_DEBUG_ALL,
  MODE_DEBUG_SINGLE,
  MODE_COUNT
};

void app_init();
void app_loop();

#endif
