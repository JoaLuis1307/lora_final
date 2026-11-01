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

// Cache de lecturas: evita leer el HC-SR04 (bloqueante hasta 30 ms) en cada
// vuelta del loop. Una lectura de hasta 1 s de antiguedad es suficiente para
// los LEDs, el reporte LoRa y la web de configuracion.
static SensorData cached_data;
static bool cached_valid = false;
static unsigned long cached_ms = 0;
static const unsigned long SENSOR_CACHE_MS = 1000;

// Watchdog del GPS: charsProcessed() es acumulativo, asi que si no cambia es
// que no estan llegando bytes NMEA.
static unsigned long gps_last_activity_ms = 0;
static uint32_t gps_last_chars = 0;

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
  // Solo se marca sano cuando realmente llegan datos NMEA.
  sensor_healthy[SENSOR_GPS] = false;
  gps_last_chars = gps.charsProcessed();
  gps_last_activity_ms = millis();
}

void sensor_update() {
  unsigned long now = millis();

  if (sensor_enabled[SENSOR_GPS]) {
    gps_update();

    uint32_t chars = gps.charsProcessed();
    if (chars > 0) sensor_healthy[SENSOR_GPS] = true;

    if (chars != gps_last_chars) {
      gps_last_chars = chars;
      gps_last_activity_ms = now; // hay actividad NMEA
    } else if (now - gps_last_activity_ms >= GPS_RETRY_INTERVAL_MS) {
      // Sin bytes nuevos: antena desconectada, cable o puerto caido.
      Serial.println("GPS sin datos NMEA, reiniciando Serial2...");
      sensor_healthy[SENSOR_GPS] = false;
      gps_init();
      gps_last_activity_ms = now;
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
  unsigned long now = millis();
  if (cached_valid && (now - cached_ms) < SENSOR_CACHE_MS) {
    return cached_data;
  }

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
    // age() evita reenviar coordenadas viejas si el GPS pierde la senal.
    if (gps.location.isValid() && gps.location.age() < GPS_FIX_MAX_AGE_MS) {
      d.lat       = gps.location.lat();
      d.lng       = gps.location.lng();
      d.altitude  = gps.altitude.meters();
      d.satellites = gps.satellites.value();
      d.gps_valid = true;
    }
  }

  cached_data = d;
  cached_ms = millis();
  cached_valid = true;
  return d;
}
