#ifndef MQ135_DRIVER_H
#define MQ135_DRIVER_H

#include <Arduino.h>

void mq135_init();
int mq135_read_raw();
float mq135_read_voltage();

#endif
