#ifndef SENSOR_SERVICE_H
#define SENSOR_SERVICE_H

#include <Arduino.h>

enum SensorType {
  SENSOR_INA219,  // index 0 - Bateria (reemplaza DHT11)
  SENSOR_MQ135,   // index 1
  SENSOR_ULTRA,   // index 2
  SENSOR_IR,      // index 3
  SENSOR_TOF,     // index 4
  SENSOR_GPS,     // index 5
  SENSOR_COUNT    // = 6
};

struct SensorData {
  float   temperature;
  float   humidity;
  int     air_quality_raw;
  float   distance_cm;
  bool    obstacle;
  uint16_t tof_mm;
  double  lat;
  double  lng;
  float   altitude;
  int     satellites;
  bool    gps_valid;
  // INA219 raw
  float   batt_voltage;
  float   batt_current_ma;
  float   batt_power_mw;
  // Bateria calculada (via battery_service)
  float   batt_soc_percent;
  float   batt_remaining_mah;
  float   batt_consumed_mah;
  float   batt_runtime_min;
  float   batt_energy_consumed_mwh;
  float   batt_energy_total_mwh;
  bool    batt_low;
  bool    batt_critical;
};

extern bool sensor_healthy[SENSOR_COUNT];
extern bool sensor_enabled[SENSOR_COUNT];

void sensor_init();
void sensor_update();
SensorData sensor_read_all();
void sensor_set_mask(uint8_t mask);
uint8_t sensor_get_mask();

#endif
