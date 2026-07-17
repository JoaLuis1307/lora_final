#include "sensor_service.h"
#include "../../config.h"
#include "../drivers/ina219_driver.h"
#include "../drivers/mq135_driver.h"
#include "../drivers/ultrasonic_driver.h"
#include "../drivers/ir_driver.h"
#include "../drivers/tof_driver.h"
#include "../drivers/gps_driver.h"
#include "battery_service.h"

bool sensor_healthy[SENSOR_COUNT] = {false};
bool sensor_enabled[SENSOR_COUNT] = {true, true, true, true, true, true};

static unsigned long last_retry = 0;
static const unsigned long RETRY_INTERVAL = 30000;

void sensor_set_mask(uint8_t mask) {
  for (int i = 0; i < SENSOR_COUNT; i++) {
    sensor_enabled[i] = (mask >> i) & 1;
  }
}

uint8_t sensor_get_mask() {
  uint8_t mask = 0;
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (sensor_enabled[i]) mask |= (1 << i);
  }
  return mask;
}

void sensor_init() {
  battery_service_init();
  sensor_healthy[SENSOR_INA219] = ina219_init();
  mq135_init();
  sensor_healthy[SENSOR_MQ135] = true;
  ultra_init();
  sensor_healthy[SENSOR_ULTRA] = true;
  ir_init();
  sensor_healthy[SENSOR_IR] = true;
  sensor_healthy[SENSOR_TOF] = tof_init();
  gps_init();
  sensor_healthy[SENSOR_GPS] = true;
}

void sensor_update() {
  if (sensor_enabled[SENSOR_GPS]) gps_update();

  unsigned long now = millis();

  if (sensor_enabled[SENSOR_GPS] && !sensor_healthy[SENSOR_GPS]) {
    if (!gps.charsProcessed()) {
      static unsigned long gps_last_init = 0;
      if (gps_last_init == 0) {
        gps_last_init = now;
      } else if (now - gps_last_init > 60000) {
        Serial.println("GPS sin datos, reintentando init...");
        gps_init();
        gps_last_init = now;
      }
    } else {
      sensor_healthy[SENSOR_GPS] = true;
    }
  }

  if (now - last_retry < RETRY_INTERVAL) return;
  last_retry = now;

  if (sensor_enabled[SENSOR_INA219] && !sensor_healthy[SENSOR_INA219]) {
    Serial.println("Reintentando INA219...");
    sensor_healthy[SENSOR_INA219] = ina219_init();
  }
  if (sensor_enabled[SENSOR_TOF] && !sensor_healthy[SENSOR_TOF]) {
    Serial.println("Reintentando VL53L0X...");
    sensor_healthy[SENSOR_TOF] = tof_init();
  }
}

SensorData sensor_read_all() {
  SensorData d;
  d.temperature       = 0;
  d.humidity          = 0;
  d.air_quality_raw   = 0;
  d.distance_cm       = -1;
  d.obstacle          = false;
  d.tof_mm            = 0;
  d.lat               = 0;
  d.lng               = 0;
  d.altitude          = 0;
  d.satellites        = 0;
  d.gps_valid         = false;
  d.batt_voltage      = 0;
  d.batt_current_ma   = 0;
  d.batt_power_mw     = 0;
  d.batt_soc_percent  = 0;
  d.batt_remaining_mah = 0;
  d.batt_consumed_mah = 0;
  d.batt_runtime_min  = 0;
  d.batt_energy_consumed_mwh = 0;
  d.batt_energy_total_mwh = 0;
  d.batt_low          = false;
  d.batt_critical     = false;

  if (sensor_enabled[SENSOR_INA219] && sensor_healthy[SENSOR_INA219]) {
    ina219_read(d.batt_voltage, d.batt_current_ma, d.batt_power_mw);
    battery_service_update(d.batt_voltage, d.batt_current_ma, d.batt_power_mw);
    BatteryStatus bs = battery_service_get_status();
    d.batt_soc_percent        = bs.soc_percent;
    d.batt_remaining_mah      = bs.remaining_mah;
    d.batt_consumed_mah       = bs.consumed_mah;
    d.batt_runtime_min        = bs.runtime_min;
    d.batt_energy_consumed_mwh = bs.energy_consumed_mwh;
    d.batt_energy_total_mwh   = bs.energy_total_mwh;
    d.batt_low                = bs.low_battery;
    d.batt_critical           = bs.critical_battery;
  }

  if (sensor_enabled[SENSOR_MQ135] && sensor_healthy[SENSOR_MQ135]) {
    d.air_quality_raw = mq135_read_raw();
  }

  if (sensor_enabled[SENSOR_ULTRA] && sensor_healthy[SENSOR_ULTRA]) {
    d.distance_cm = ultra_read_cm();
  }

  if (sensor_enabled[SENSOR_IR] && sensor_healthy[SENSOR_IR]) {
    d.obstacle = ir_obstacle_detected();
  }

  if (sensor_enabled[SENSOR_TOF] && sensor_healthy[SENSOR_TOF]) {
    uint16_t tof_val = 0;
    if (tof_read(tof_val)) {
      d.tof_mm = tof_val;
    }
  }

  if (sensor_enabled[SENSOR_GPS] && sensor_healthy[SENSOR_GPS]) {
    if (gps.location.isValid()) {
      d.lat       = gps.location.lat();
      d.lng       = gps.location.lng();
      d.altitude  = gps.altitude.meters();
      d.satellites = gps.satellites.value();
      d.gps_valid = true;
    }
  }

  return d;
}
