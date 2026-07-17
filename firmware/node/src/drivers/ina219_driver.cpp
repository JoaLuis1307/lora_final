#include "ina219_driver.h"
#include <Wire.h>
#include <Adafruit_INA219.h>

static Adafruit_INA219 ina219;

bool ina219_init() {
  if (!ina219.begin()) {
    Serial.println("INA219: no detectado");
    return false;
  }
  ina219.setCalibration_32V_2A();
  Serial.println("INA219 OK (32V 2A)");
  return true;
}

bool ina219_read(float& voltage, float& current_ma, float& power_mw) {
  voltage = ina219.getBusVoltage_V();
  current_ma = ina219.getCurrent_mA();
  power_mw = ina219.getPower_mW();
  return true;
}
