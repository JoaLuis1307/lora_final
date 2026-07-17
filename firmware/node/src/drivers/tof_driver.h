#ifndef TOF_DRIVER_H
#define TOF_DRIVER_H

#include <Arduino.h>
#include <Wire.h>
#include <VL53L0X.h>

bool tof_init();
bool tof_read(uint16_t& distance_mm);

#endif
