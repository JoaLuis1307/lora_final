#ifndef NODE_STORE_H
#define NODE_STORE_H

#include <Arduino.h>

struct NodeInfo {
  char id[16];
  int air_quality;
  float ultrasonic_cm;
  int tof_cm;
  bool obstacle;
  float latitude;
  float longitude;
  float altitude;
  int satellites;
  float battery;
  float battery_pct;
  float batt_current_ma;
  float batt_power_mw;
  float batt_remaining_mah;
  float batt_consumed_mah;
  float batt_runtime_min;
  float batt_energy_consumed_mwh;
  float batt_energy_total_mwh;
  bool  batt_low;
  bool  batt_critical;
  int rssi;
  float snr;
  unsigned long sequence;
  unsigned long last_seen;
  bool active;
};

#define MAX_STORED_NODES 10
#define MAX_ALLOWED_NODES 16

extern NodeInfo stored_nodes[MAX_STORED_NODES];
extern int stored_node_count;

void node_store_init();
void node_store_update(const char* node_id, const String& json, int rssi, float snr);
void node_store_touch(const char* node_id);
String node_store_get_json();

// Gestion de whitelist de nodos (NVS)
void node_whitelist_init();
bool node_whitelist_add(const char* node_id);
bool node_whitelist_remove(const char* node_id);
bool node_whitelist_is_allowed(const char* node_id);
String node_whitelist_get_json();
int node_whitelist_count();

#endif
