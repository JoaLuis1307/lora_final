#include "node_store.h"
#include "parser_service.h"
#include <Preferences.h>

NodeInfo stored_nodes[MAX_STORED_NODES];
int stored_node_count = 0;

// Whitelist de nodos permitidos (almacenada en NVS)
static char allowed_nodes[MAX_ALLOWED_NODES][16];
static int allowed_count = 0;
static Preferences node_prefs;

void node_store_init() {
  stored_node_count = 0;
  memset(stored_nodes, 0, sizeof(stored_nodes));
  node_whitelist_init();
}

static int find_node(const char* id) {
  for (int i = 0; i < stored_node_count; i++) {
    if (strcmp(stored_nodes[i].id, id) == 0) return i;
  }
  return -1;
}

void node_store_update(const char* node_id, const String& json, int rssi, float snr) {
  int idx = find_node(node_id);
  if (idx < 0) {
    if (stored_node_count >= MAX_STORED_NODES) return;
    idx = stored_node_count++;
    memset(&stored_nodes[idx], 0, sizeof(NodeInfo));
    strncpy(stored_nodes[idx].id, node_id, sizeof(stored_nodes[idx].id) - 1);
  }

  NodeInfo& n = stored_nodes[idx];
  String val;

  val = parser_extract_value(json.c_str(), "air_quality");
  if (val.length() > 0) n.air_quality = val.toInt();

  val = parser_extract_value(json.c_str(), "ultrasonic_cm");
  if (val.length() > 0) n.ultrasonic_cm = val.toFloat();

  val = parser_extract_value(json.c_str(), "tof_cm");
  if (val.length() > 0) n.tof_cm = val.toInt();

  val = parser_extract_value(json.c_str(), "obstacle");
  if (val.length() > 0) n.obstacle = val.toInt() != 0;

  val = parser_extract_value(json.c_str(), "altitude");
  if (val.length() > 0) n.altitude = val.toFloat();

  val = parser_extract_value(json.c_str(), "latitude");
  if (val.length() > 0) n.latitude = val.toFloat();

  val = parser_extract_value(json.c_str(), "longitude");
  if (val.length() > 0) n.longitude = val.toFloat();

  val = parser_extract_value(json.c_str(), "satellites");
  if (val.length() > 0) n.satellites = val.toInt();

  val = parser_extract_value(json.c_str(), "battery");
  if (val.length() > 0) n.battery = val.toFloat();

  val = parser_extract_value(json.c_str(), "battery_pct");
  if (val.length() > 0) n.battery_pct = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_current_ma");
  if (val.length() > 0) n.batt_current_ma = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_power_mw");
  if (val.length() > 0) n.batt_power_mw = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_remaining_mah");
  if (val.length() > 0) n.batt_remaining_mah = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_consumed_mah");
  if (val.length() > 0) n.batt_consumed_mah = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_runtime_min");
  if (val.length() > 0) n.batt_runtime_min = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_energy_consumed_mwh");
  if (val.length() > 0) n.batt_energy_consumed_mwh = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_energy_total_mwh");
  if (val.length() > 0) n.batt_energy_total_mwh = val.toFloat();

  val = parser_extract_value(json.c_str(), "batt_low");
  if (val.length() > 0) n.batt_low = val.toInt() != 0;

  val = parser_extract_value(json.c_str(), "batt_critical");
  if (val.length() > 0) n.batt_critical = val.toInt() != 0;

  val = parser_extract_value(json.c_str(), "sequence");
  if (val.length() > 0) n.sequence = val.toInt();

  n.rssi = rssi;
  n.snr = snr;
  n.last_seen = millis();
  n.active = true;
}

void node_store_touch(const char* node_id) {
  int idx = find_node(node_id);
  if (idx >= 0) {
    stored_nodes[idx].last_seen = millis();
    stored_nodes[idx].active = true;
  }
}

String node_store_get_json() {
  String json = "[";
  for (int i = 0; i < stored_node_count; i++) {
    if (i > 0) json += ",";
    NodeInfo& n = stored_nodes[i];
    unsigned long ago = (millis() - n.last_seen) / 1000;

    json += "{";
    json += "\"id\":\"" + String(n.id) + "\"";
    json += ",\"air_quality\":" + String(n.air_quality);
    json += ",\"ultrasonic_cm\":" + String(n.ultrasonic_cm, 1);
    json += ",\"tof_cm\":" + String(n.tof_cm);
    json += ",\"obstacle\":" + String(n.obstacle ? "true" : "false");
    json += ",\"latitude\":" + String(n.latitude, 6);
    json += ",\"longitude\":" + String(n.longitude, 6);
    json += ",\"altitude\":" + String(n.altitude, 1);
    json += ",\"satellites\":" + String(n.satellites);
    json += ",\"battery\":" + String(n.battery, 2);
    json += ",\"battery_pct\":" + String(n.battery_pct, 1);
    json += ",\"batt_current_ma\":" + String(n.batt_current_ma, 1);
    json += ",\"batt_power_mw\":" + String(n.batt_power_mw, 0);
    json += ",\"batt_remaining_mah\":" + String(n.batt_remaining_mah, 0);
    json += ",\"batt_consumed_mah\":" + String(n.batt_consumed_mah, 1);
    json += ",\"batt_runtime_min\":" + String(n.batt_runtime_min, 0);
    json += ",\"batt_energy_consumed_mwh\":" + String(n.batt_energy_consumed_mwh, 1);
    json += ",\"batt_energy_total_mwh\":" + String(n.batt_energy_total_mwh, 0);
    json += ",\"batt_low\":" + String(n.batt_low ? "true" : "false");
    json += ",\"batt_critical\":" + String(n.batt_critical ? "true" : "false");
    json += ",\"rssi\":" + String(n.rssi);
    json += ",\"snr\":" + String(n.snr, 1);
    json += ",\"sequence\":" + String(n.sequence);
    json += ",\"last_seen_sec\":" + String(ago);
    json += ",\"active\":" + String((ago < 60) ? "true" : "false");
    json += ",\"whitelisted\":" + String(node_whitelist_is_allowed(n.id) ? "true" : "false");
    json += "}";
  }
  json += "]";
  return json;
}

// ===================== WHITELIST (NVS) =====================

void node_whitelist_init() {
  node_prefs.begin("nodes", true);
  allowed_count = node_prefs.getInt("count", 0);
  if (allowed_count > MAX_ALLOWED_NODES) allowed_count = MAX_ALLOWED_NODES;
  for (int i = 0; i < allowed_count; i++) {
    String key = "n" + String(i);
    strncpy(allowed_nodes[i], node_prefs.getString(key.c_str(), "").c_str(), 15);
    allowed_nodes[i][15] = '\0';
  }
  node_prefs.end();

  Serial.println("[NODES] Whitelist cargada: " + String(allowed_count) + " nodos");
  for (int i = 0; i < allowed_count; i++) {
    Serial.println("  [" + String(i) + "] " + String(allowed_nodes[i]));
  }
}

static void whitelist_save() {
  node_prefs.begin("nodes", false);
  node_prefs.putInt("count", allowed_count);
  for (int i = 0; i < allowed_count; i++) {
    String key = "n" + String(i);
    node_prefs.putString(key.c_str(), allowed_nodes[i]);
  }
  node_prefs.end();
}

bool node_whitelist_add(const char* node_id) {
  if (!node_id || strlen(node_id) == 0) return false;
  if (strlen(node_id) > 15) return false;

  // Verificar si ya existe
  for (int i = 0; i < allowed_count; i++) {
    if (strcmp(allowed_nodes[i], node_id) == 0) return false;
  }

  if (allowed_count >= MAX_ALLOWED_NODES) return false;

  strncpy(allowed_nodes[allowed_count], node_id, 15);
  allowed_nodes[allowed_count][15] = '\0';
  allowed_count++;
  whitelist_save();

  Serial.println("[NODES] Nodo agregado: " + String(node_id) + " (total: " + String(allowed_count) + ")");
  return true;
}

bool node_whitelist_remove(const char* node_id) {
  if (!node_id) return false;

  for (int i = 0; i < allowed_count; i++) {
    if (strcmp(allowed_nodes[i], node_id) == 0) {
      // Mover el ultimo sobre este
      for (int j = i; j < allowed_count - 1; j++) {
        strncpy(allowed_nodes[j], allowed_nodes[j + 1], 15);
        allowed_nodes[j][15] = '\0';
      }
      allowed_count--;
      memset(allowed_nodes[allowed_count], 0, 16);
      whitelist_save();

      Serial.println("[NODES] Nodo eliminado: " + String(node_id) + " (total: " + String(allowed_count) + ")");
      return true;
    }
  }
  return false;
}

bool node_whitelist_is_allowed(const char* node_id) {
  if (!node_id || strlen(node_id) == 0) return false;
  if (allowed_count == 0) return true; // Si la lista esta vacia, permitir todos

  for (int i = 0; i < allowed_count; i++) {
    if (strcmp(allowed_nodes[i], node_id) == 0) return true;
  }
  return false;
}

String node_whitelist_get_json() {
  String json = "{\"nodes\":[";
  for (int i = 0; i < allowed_count; i++) {
    if (i > 0) json += ",";
    json += "\"" + String(allowed_nodes[i]) + "\"";
  }
  json += "],\"count\":" + String(allowed_count) + ",\"max\":" + String(MAX_ALLOWED_NODES) + "}";
  return json;
}

int node_whitelist_count() {
  return allowed_count;
}
