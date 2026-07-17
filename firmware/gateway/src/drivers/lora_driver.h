#ifndef LORA_DRIVER_H
#define LORA_DRIVER_H

#include <LoRa.h>

extern bool lora_alive;
extern int lora_last_rssi;
extern float lora_last_snr;

void lora_init();
void lora_check();
bool lora_send(const uint8_t* data, size_t len);
int lora_available();
int lora_read();
String lora_read_string();

#endif
