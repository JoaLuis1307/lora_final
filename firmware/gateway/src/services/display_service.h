#ifndef DISPLAY_SERVICE_H
#define DISPLAY_SERVICE_H

#include <Arduino.h>

enum DisplayMode {
  DISP_STATUS,
  DISP_TELEMETRY,
  DISP_SIGNAL,
  DISP_COUNT
};

extern DisplayMode display_mode;

struct TelemetryDisplay {
  char node_id[8];
  float battery_v;
  float battery_pct;
  int aq;
  int dist;
  int tof;
  int ir;
  int alt;
  int sats;
};

struct SignalDisplay {
  char node_id[8];
  int rssi;
  float snr;
  unsigned long packets;
  unsigned long crc_errs;
};

void display_service_init();
void display_show_splash();
void display_show_ap_mode(const char* ssid, const char* ip);
void display_show_confirm_prompt(unsigned long seconds_left);
void display_show_status(bool wifi_on, bool mqtt_on, bool lora_on);
void display_update_telemetry(const TelemetryDisplay& td);
void display_update_signal(const char* node_id, int rssi, float snr, unsigned long packets, unsigned long crc_errs);
void display_render();
void display_next_mode();
void display_show_serial_menu();

#endif
