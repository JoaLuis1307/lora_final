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
