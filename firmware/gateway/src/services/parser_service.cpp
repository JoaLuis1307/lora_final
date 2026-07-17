#include "parser_service.h"
#include "../../config.h"
#include "web_service.h"

static int find_key(const char* json, const char* key) {
  String search = String("\"") + key + "\"";
  return json ? String(json).indexOf(search) : -1;
}

bool parser_is_json(const char* raw) {
  if (!raw || strlen(raw) < 2) return false;
  return raw[0] == '{' && raw[strlen(raw) - 1] == '}';
}

String parser_extract_value(const char* json, const char* key) {
  int pos = find_key(json, key);
  if (pos < 0) return "";
  String j = String(json);
  int colon = j.indexOf(':', pos);
  if (colon < 0) return "";
  int start = j.indexOf('"', colon + 1);
  if (start < 0) {
    start = colon + 1;
    while (start < (int)j.length() && j[start] == ' ') start++;
    int end = start;
    while (end < (int)j.length() && j[end] != ',' && j[end] != '}') end++;
    return j.substring(start, end);
  }
  int end = j.indexOf('"', start + 1);
  if (end < 0) return "";
  return j.substring(start + 1, end);
}

String parser_build_json(const char* key, const char* value) {
  return "{\"" + String(key) + "\":\"" + String(value) + "\"}";
}

String parser_compact_to_json(const String& payload) {
  String json = "{";
  int start = 0;
  bool first = true;

  while (start < (int)payload.length()) {
    int comma = payload.indexOf(',', start);
    if (comma < 0) comma = payload.length();
    String field = payload.substring(start, comma);
    start = comma + 1;
    if (field.length() == 0) continue;

    int i = 0;
    while (i < (int)field.length() && isAlpha(field[i])) i++;
    String key = field.substring(0, i);
    String val = field.substring(i);

    if (key.length() == 0 || val.length() == 0) continue;

    if (!first) json += ",";
    first = false;

    String json_key;
    if (key == "P")         json_key = "sequence";
    else if (key == "T")    json_key = "temperature";
    else if (key == "H")    json_key = "humidity";
    else if (key == "AQ")   json_key = "air_quality";
    else if (key == "U")    json_key = "ultrasonic_cm";
    else if (key == "TOF")  json_key = "tof_cm";
    else if (key == "IR")   json_key = "obstacle";
    else if (key == "B")    json_key = "altitude";
    else if (key == "S")    json_key = "satellites";
    else if (key == "BAT")  json_key = "battery";
    else if (key == "BATP") json_key = "battery_pct";
    else if (key == "RSSI") json_key = "rssi";
    else if (key == "SNR")  json_key = "snr";
    else if (key == "LA")   json_key = "latitude";
    else if (key == "LO")   json_key = "longitude";
    else if (key == "CRC")  json_key = "crc";
    else                    json_key = key;

    json += "\"" + json_key + "\":" + val;
  }

  json += "}";
  return json;
}

String parser_get_token(const String& msg, int index, char sep) {
  int start = 0;
  for (int i = 0; i < index; i++) {
    int pos = msg.indexOf(sep, start);
    if (pos < 0) return "";
    start = pos + 1;
  }
  int end = msg.indexOf(sep, start);
  if (end < 0) end = msg.length();
  return msg.substring(start, end);
}

String parser_get_topic_segment(const String& topic, int index) {
  return parser_get_token(topic, index, '/');
}

String parser_get_node_id(const String& lora_msg) {
  return parser_get_token(lora_msg, 0, '|');
}

String parser_get_data_type(const String& lora_msg) {
  return parser_get_token(lora_msg, 1, '|');
}

String parser_get_payload(const String& lora_msg) {
  return parser_get_token(lora_msg, 2, '|');
}

String parser_build_node_topic(const String& node_id, const String& data_type) {
  String topic = "lora/";
  topic += web_service_get_gateway_id();
  topic += "/";
  topic += node_id;
  topic += "/";
  topic += data_type;
  return topic;
}
