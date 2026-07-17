#ifndef NODE_CONFIG_SERVICE_H
#define NODE_CONFIG_SERVICE_H

#include <Arduino.h>

void node_config_start_ap();
void node_config_web_loop();
bool node_config_is_ap_active();
void node_config_load();
void node_config_save();
const char* node_config_get_id();
int node_config_get_interval();
int node_config_get_lora_freq();
int node_config_get_deep_sleep();
uint8_t node_config_get_sensor_mask();
int node_config_get_wifi_mode();
void node_config_set_ap_request();

#endif
