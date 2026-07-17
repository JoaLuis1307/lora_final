#ifndef INA219_DRIVER_H
#define INA219_DRIVER_H

#include <Arduino.h>

bool ina219_init();
bool ina219_read(float& voltage, float& current_ma, float& power_mw);

#endif
