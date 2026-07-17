#ifndef GPS_DRIVER_H
#define GPS_DRIVER_H

#include <Arduino.h>
#include <TinyGPSPlus.h>

extern TinyGPSPlus gps;

void gps_init();
void gps_update();

#endif
