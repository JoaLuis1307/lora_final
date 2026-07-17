#include "router_service.h"
#include "mqtt_service.h"
#include "parser_service.h"
#include "node_store.h"
#include "../drivers/lora_driver.h"
#include "display_service.h"

unsigned long router_packets = 0;
unsigned long router_crc_errors = 0;

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

// Extracts CRC from payload end, validates, returns clean payload
static String validate_crc(const String& raw, bool& crc_ok) {
  crc_ok = false;
  int last_comma = raw.lastIndexOf(',');
  if (last_comma < 0) return raw;

  String last_field = raw.substring(last_comma + 1);
  if (!last_field.startsWith("CRC")) return raw;

  uint8_t received_crc = (uint8_t)last_field.substring(3).toInt();
  String clean = raw.substring(0, last_comma);
  uint8_t calc_crc = crc8((const uint8_t*)clean.c_str(), clean.length());
  crc_ok = (received_crc == calc_crc);
  return clean;
}

static void parse_compact_for_display(const String& payload, TelemetryDisplay& td) {
  int start = 0;
  while (start < (int)payload.length()) {
    int comma = payload.indexOf(',', start);
    if (comma < 0) comma = payload.length();
    String field = payload.substring(start, comma);
    start = comma + 1;
    if (field.length() == 0) continue;

    int i = 0;
    while (i < (int)field.length() && isAlpha(field[i])) i++;
    String key = field.substring(0, i);
    String valStr = field.substring(i);

    if (key == "P" || key == "CRC")  { /* skip */ }
    else if (key == "BAT") td.battery_v = valStr.toFloat();
    else if (key == "BATP") td.battery_pct = valStr.toFloat();
    else {
      int val = valStr.toInt();
      if (key == "AQ")   td.aq = val;
      else if (key == "U")    td.dist = val;
      else if (key == "TOF")  td.tof = val;
      else if (key == "IR")   td.ir = val;
      else if (key == "B")    td.alt = val;
      else if (key == "S")    td.sats = val;
    }
  }
}

void router_init() {
  Serial.println("Router iniciado");
}

void router_loop() {
  if (!lora_available()) return;

  String raw = lora_read_string();
  router_packets++;
  Serial.print("LoRa RX: ");
  Serial.println(raw);

  int first_comma = raw.indexOf(',');
  int first_pipe = raw.indexOf('|');
  if (first_comma > 1 && (first_pipe < 0 || first_comma < first_pipe)) {
    String node_id = raw.substring(0, first_comma);
    bool valid_id = (node_id.length() > 0 && node_id.length() <= 15);
    if (!valid_id) {
      Serial.println("Router: node_id invalido, ignorando");
      return;
    }

    // Verificar whitelist - solo nodos permitidos
    if (!node_whitelist_is_allowed(node_id.c_str())) {
      Serial.println("  -> Nodo " + node_id + " NO permitido (fuera de whitelist)");
      return;
    }

    bool crc_ok = false;
    String clean_raw = validate_crc(raw, crc_ok);
    if (!crc_ok) router_crc_errors++;

    String payload = clean_raw.substring(first_comma + 1);

    if (payload.startsWith("ACK")) {
      String ack_data = payload.substring(3);
      int ack_comma = ack_data.indexOf(',');
      if (ack_comma > 0) ack_data = ack_data.substring(0, ack_comma);
      String ack_json = "{\"ack\":" + ack_data + "}";
      router_handle_ack(node_id, ack_json);
      node_store_touch(node_id.c_str());
      display_update_signal(node_id.c_str(), lora_last_rssi, lora_last_snr, router_packets, router_crc_errors);
      return;
    }

    TelemetryDisplay td = {};
    strncpy(td.node_id, node_id.c_str(), sizeof(td.node_id) - 1);
    parse_compact_for_display(payload, td);
    display_update_telemetry(td);
    display_update_signal(node_id.c_str(), lora_last_rssi, lora_last_snr, router_packets, router_crc_errors);

    String json = parser_compact_to_json(payload);
    json.remove(json.length() - 1);
    json += ",\"timestamp\":" + String(millis() / 1000);
    json += ",\"rssi\":" + String(lora_last_rssi);
    json += ",\"snr\":" + String(lora_last_snr);
    json += ",\"pkts\":" + String(router_packets);
    json += ",\"crc_ok\":" + String(crc_ok ? 1 : 0);
    json += ",\"crc_err\":" + String(router_crc_errors);
    json += "}";

    if (!crc_ok) {
      Serial.println("  -> CRC ERROR!");
    }

    router_handle_telemetry(node_id, json);
    node_store_update(node_id.c_str(), json, lora_last_rssi, lora_last_snr);
    return;
  }

  String node_id = parser_get_node_id(raw);
  String type = parser_get_data_type(raw);
  String payload = parser_get_payload(raw);

  if (node_id.length() == 0) {
    Serial.println("Router: node_id invalido, ignorando");
    return;
  }

  // Verificar whitelist - solo nodos permitidos
  if (!node_whitelist_is_allowed(node_id.c_str())) {
    Serial.println("  -> Nodo " + node_id + " NO permitido (fuera de whitelist)");
    return;
  }

  if (payload.length() == 0) payload = raw;

  if (type == "telemetry") {
    router_handle_telemetry(node_id, payload);
    node_store_update(node_id.c_str(), payload, lora_last_rssi, lora_last_snr);
  } else if (type == "system") {
    router_handle_system(node_id, payload);
    node_store_touch(node_id.c_str());
  } else if (type == "event") {
    router_handle_event(node_id, payload);
    node_store_touch(node_id.c_str());
  } else if (type == "ack") {
    router_handle_ack(node_id, payload);
    node_store_touch(node_id.c_str());
  } else {
    router_handle_telemetry(node_id, raw);
  }
}

void router_handle_telemetry(const String& node_id, const String& payload) {
  String topic = parser_build_node_topic(node_id, "telemetry");
  String data = parser_is_json(payload.c_str()) ? payload : parser_build_json("value", payload.c_str());

  if (mqtt_is_connected()) {
    mqtt_publish(topic.c_str(), data.c_str());
    Serial.print("  -> MQTT telemetry [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(data);
  } else {
    Serial.print("  -> MQTT DESCONECTADO! No se publica telemetry del nodo ");
    Serial.print(node_id);
    Serial.print(" (topic: ");
    Serial.print(topic);
    Serial.println(")");
  }

  String ack_msg = node_id + "|ack|1";
  lora_send((const uint8_t*)ack_msg.c_str(), ack_msg.length());
}

void router_handle_system(const String& node_id, const String& payload) {
  String topic = parser_build_node_topic(node_id, "system");
  String data = parser_is_json(payload.c_str()) ? payload : parser_build_json("info", payload.c_str());

  if (mqtt_is_connected()) {
    mqtt_publish(topic.c_str(), data.c_str());
    Serial.print("  -> MQTT system [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(data);
  } else {
    Serial.println("  -> MQTT DESCONECTADO! system del nodo " + node_id);
  }
}

void router_handle_event(const String& node_id, const String& payload) {
  String topic = parser_build_node_topic(node_id, "events");
  String data = parser_is_json(payload.c_str()) ? payload : parser_build_json("event", payload.c_str());

  if (mqtt_is_connected()) {
    mqtt_publish(topic.c_str(), data.c_str());
    Serial.print("  -> MQTT events [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(data);
  } else {
    Serial.println("  -> MQTT DESCONECTADO! events del nodo " + node_id);
  }
}

void router_handle_ack(const String& node_id, const String& payload) {
  String topic = parser_build_node_topic(node_id, "ack");
  String data = parser_is_json(payload.c_str()) ? payload : parser_build_json("ack", payload.c_str());

  if (mqtt_is_connected()) {
    mqtt_publish(topic.c_str(), data.c_str());
    Serial.print("  -> MQTT ack [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(data);
  } else {
    Serial.println("  -> MQTT DESCONECTADO! ack del nodo " + node_id);
  }
}

void router_send_command_to_lora(const String& node_id, const String& command) {
  String msg = node_id + "|command|" + command;
  lora_send((const uint8_t*)msg.c_str(), msg.length());
  Serial.print("LoRa TX command to ");
  Serial.print(node_id);
  Serial.print(": ");
  Serial.println(command);
}
