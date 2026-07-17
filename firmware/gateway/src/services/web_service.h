#ifndef WEB_SERVICE_H
#define WEB_SERVICE_H

#include <Arduino.h>

void web_service_init();
void web_service_loop();
const char* web_service_get_gateway_id();

#endif
