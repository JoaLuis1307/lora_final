#ifndef MQTT_SERVICE_H
#define MQTT_SERVICE_H

#include <PubSubClient.h>

extern PubSubClient mqtt_client;
extern volatile bool mqtt_connected_flag;

void mqtt_service_init();
bool mqtt_reconnect();
void mqtt_loop();
bool mqtt_is_connected();
void mqtt_publish(const char* topic, const char* payload);
void mqtt_publish_status(bool online, const char* ip);
void mqtt_publish_info();
void mqtt_publish_stats(unsigned long packets, unsigned long crc_errs, int nodes);

#endif
