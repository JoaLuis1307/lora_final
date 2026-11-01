#ifndef WEB_SERVICE_H
#define WEB_SERVICE_H

#include <Arduino.h>

void web_service_init();
void web_service_loop();
const char* web_service_get_gateway_id();
int web_service_get_lora_freq();
const char* web_service_get_mqtt_server();
int web_service_get_mqtt_port();
const char* web_service_get_mqtt_user();
const char* web_service_get_mqtt_pass();

#endif
