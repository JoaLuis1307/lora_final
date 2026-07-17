#ifndef ROUTER_SERVICE_H
#define ROUTER_SERVICE_H

#include <Arduino.h>

extern unsigned long router_packets;
extern unsigned long router_crc_errors;

void router_init();
void router_loop();

void router_handle_telemetry(const String& node_id, const String& payload);
void router_handle_system(const String& node_id, const String& payload);
void router_handle_event(const String& node_id, const String& payload);
void router_handle_ack(const String& node_id, const String& payload);

void router_send_command_to_lora(const String& node_id, const String& command);

#endif
