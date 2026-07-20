#include "report_service.h"
#include "../../config.h"
#include "sensor_service.h"
#include "node_config_service.h"
#include "../drivers/lora_driver.h"

static unsigned long seq = 0;

static uint8_t crc8(const uint8_t* data, size_t len) {
  uint8_t crc = 0x00;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      if (crc & 0x80) crc = (crc << 1) ^ 0x07;
      else crc <<= 1;
    }
  }
  return crc;
}

void report_init() {}

void report_send() {
  SensorData d = sensor_read_all();
  seq++;

  String payload = "P" + String(seq);
  payload += ",AQ" + String(d.air_quality_raw);
  payload += ",U" + String((int)d.distance_cm);
  payload += ",TOF" + String(d.tof_mm / 10);
  payload += ",IR" + String(d.obstacle ? 1 : 0);

  if (d.gps_valid) {
    payload += ",LA" + String(d.lat, 6);
    payload += ",LO" + String(d.lng, 6);
    payload += ",B" + String((int)d.altitude);
    payload += ",S" + String(d.satellites);
  } else {
    payload += ",LA0,LO0,B0,S0";
  }

  payload += ",BAT" + String(d.batt_voltage, 2);
  payload += ",BATP" + String(d.batt_soc_percent, 0);
  payload += ",BI" + String(d.batt_current_ma, 1);
  payload += ",BW" + String(d.batt_power_mw, 0);
  payload += ",BR" + String(d.batt_remaining_mah, 0);
  payload += ",BE" + String(d.batt_consumed_mah, 1);
  payload += ",BT" + String(d.batt_runtime_min, 0);
  payload += ",BEC" + String(d.batt_energy_consumed_mwh, 1);
  payload += ",BET" + String(d.batt_energy_total_mwh, 0);
  payload += ",BL" + String(d.batt_low ? 1 : 0);
  payload += ",BK" + String(d.batt_critical ? 1 : 0);

  String node_id = String(node_config_get_id());
  String msg = node_id + "," + payload;

  uint8_t crc_val = crc8((const uint8_t*)msg.c_str(), msg.length());
  msg += ",CRC" + String(crc_val);

  Serial.print("Enviando [");
  Serial.print(node_id);
  Serial.print("]: ");
  Serial.println(payload);

  if (lora_send_with_retries(msg, 3)) {
    Serial.println("  -> LoRa OK");
  } else {
    Serial.println("  -> LoRa fallo (3 reintentos agotados)");
  }
}
