#ifndef WIFI_DRIVER_H
#define WIFI_DRIVER_H

#include <WiFi.h>

void wifi_init();
void wifi_reconnect();
void wifi_button_init();
void wifi_button_check();
bool wifi_is_confirm_mode();
unsigned long wifi_confirm_remaining();
bool wifi_handle_confirm();
bool wifi_is_connected();
bool wifi_is_ap_active();
int wifi_ap_client_count();
void wifi_ap_exit();
String wifi_get_ip();
String wifi_get_mode_str();
void wifi_dns_loop();

#endif
