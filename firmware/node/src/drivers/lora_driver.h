#ifndef LORA_DRIVER_H
#define LORA_DRIVER_H

#include <LoRa.h>

extern bool lora_ready;
extern float lora_last_rssi;
extern float lora_last_snr;
extern float lora_noise_floor;
extern unsigned long lora_tx_count;
extern unsigned long lora_rx_count;

void lora_init();
bool lora_send(const String& data);
bool lora_send_with_retries(const String& data, int max_retries = 3);
int lora_available();
String lora_read_string();
float lora_read_noise();

#endif
