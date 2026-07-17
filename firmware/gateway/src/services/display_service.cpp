#include "display_service.h"
#include "../drivers/oled_driver.h"
#include "../drivers/wifi_driver.h"

DisplayMode display_mode = DISP_STATUS;

static TelemetryDisplay last_td = {};
static SignalDisplay last_sig = {0, 0, 0};
static bool last_wifi = false;
static bool last_mqtt = false;
static bool last_lora = false;
static bool has_telemetry = false;

void display_service_init() {
  oled_init();
  display_show_splash();
  delay(1000);
}

void display_show_splash() {
  oled_clear();
  oled_println(20, 0, "ESP32-S3 GATEWAY");
  oled_line(0, 10, 127, 10);
  oled_println(10, 25, "Iniciando...");
  oled_render();
}

void display_show_ap_mode(const char* ssid, const char* ip) {
  oled_clear();
  oled_println(15, 0, "=== MODO AP ===");
  oled_line(0, 10, 127, 10);
  oled_println(0, 16, "SSID:");
  oled_println(0, 26, ssid);
  oled_println(0, 40, "IP:");
  oled_println(0, 50, ip);
  oled_println(0, 60, "Largo=Salir");
  oled_render();
}

void display_show_confirm_prompt(unsigned long seconds_left) {
  oled_clear();
  oled_println(10, 0, "=== MODO CONFIG ===");
  oled_line(0, 10, 127, 10);
  oled_println(0, 18, "Pulse para entrar");
  oled_println(0, 30, "en configuracion");
  oled_println(0, 44, "Largo=Cancelar");
  char buf[16];
  snprintf(buf, sizeof(buf), "Tiempo: %lus", seconds_left);
  oled_println(80, 0, buf);
  oled_render();
}

void display_show_status(bool wifi_on, bool mqtt_on, bool lora_on) {
  last_wifi = wifi_on;
  last_mqtt = mqtt_on;
  last_lora = lora_on;
  if (display_mode != DISP_STATUS) return;

  oled_clear();
  oled_println(20, 0, "=== ESTADO ===");
  oled_line(0, 10, 127, 10);

  oled_print(0, 18, "Red:");
  String mode = wifi_get_mode_str();
  oled_println(45, 18, mode.c_str());

  oled_print(0, 32, "Mqtt:");
  oled_println(45, 32, mqtt_on ? "ON" : "OFF");

  oled_print(0, 46, "Lora:");
  oled_println(45, 46, lora_on ? "ON" : "OFF");
  oled_render();
}

void display_update_telemetry(const TelemetryDisplay& td) {
  last_td = td;
  has_telemetry = true;
  if (display_mode == DISP_TELEMETRY) display_render();
}

void display_update_signal(const char* node_id, int rssi, float snr, unsigned long packets, unsigned long crc_errs) {
  strncpy(last_sig.node_id, node_id, sizeof(last_sig.node_id) - 1);
  last_sig.rssi = rssi;
  last_sig.snr = snr;
  last_sig.packets = packets;
  last_sig.crc_errs = crc_errs;
  if (display_mode == DISP_SIGNAL) display_render();
}

void display_next_mode() {
  display_mode = (DisplayMode)((display_mode + 1) % DISP_COUNT);
  display_render();
}

void display_render() {
  oled_clear();

  char header[16];
  snprintf(header, sizeof(header), "=== MODO %d/%d ===", display_mode + 1, DISP_COUNT);
  oled_println(0, 0, header);
  oled_line(0, 10, 127, 10);

  switch (display_mode) {
    case DISP_STATUS: {
      oled_println(10, 18, "--- ESTADO ---");
      oled_print(0, 30, "Red:");
      String mode = wifi_get_mode_str();
      oled_println(45, 30, mode.c_str());
      oled_print(0, 42, "Mqtt:");
      oled_println(45, 42, last_mqtt ? "ON" : "OFF");
      oled_print(0, 54, "Lora:");
      oled_println(45, 54, last_lora ? "ON" : "OFF");
      break;
    }

    case DISP_TELEMETRY: {
      if (!has_telemetry) {
        oled_println(10, 18, "Esperando datos...");
        oled_render();
        return;
      }
      char buf[22];
      snprintf(buf, sizeof(buf), "Nodo:%s", last_td.node_id);
      oled_println(0, 18, buf);
      snprintf(buf, sizeof(buf), "BAT:%.1f%% %.2fV", last_td.battery_pct, last_td.battery_v);
      oled_println(0, 30, buf);
      snprintf(buf, sizeof(buf), "U:%dcm TOF:%dcm", last_td.dist, last_td.tof);
      oled_println(0, 42, buf);
      snprintf(buf, sizeof(buf), "IR:%d ALT:%dm", last_td.ir, last_td.alt);
      oled_println(0, 54, buf);
      break;
    }

    case DISP_SIGNAL: {
      char buf[22];
      snprintf(buf, sizeof(buf), "Nodo:%s", last_sig.node_id);
      oled_println(0, 18, buf);
      snprintf(buf, sizeof(buf), "RSSI:%d dBm", last_sig.rssi);
      oled_println(0, 30, buf);
      snprintf(buf, sizeof(buf), "SNR:%.1f dB", (double)last_sig.snr);
      oled_println(0, 42, buf);
      snprintf(buf, sizeof(buf), "Paq:%lu CRC:%lu", last_sig.packets, last_sig.crc_errs);
      oled_println(0, 54, buf);
      break;
    }

    default:
      break;
  }

  oled_render();
}

static void print_mode_name() {
  switch (display_mode) {
    case DISP_STATUS:    Serial.print("Estado"); break;
    case DISP_TELEMETRY: Serial.print("Telemetria"); break;
    case DISP_SIGNAL:    Serial.print("Senal"); break;
    default:             Serial.print("?"); break;
  }
}

void display_show_serial_menu() {
  Serial.println("");
  Serial.println("=================================");
  Serial.println("    GATEWAY - MENU INTERACTIVO    ");
  Serial.println("=================================");
  Serial.println("  [0] Estado     - WiFi/MQTT/LoRa");
  Serial.println("  [1] Telemetria - Datos del nodo");
  Serial.println("  [2] Senal      - RSSI/SNR/Paqs ");
  Serial.println("  [i] Info       - Sistema        ");
  Serial.println("  [s] Stats      - Paquetes/CRC   ");
  Serial.println("  [t] Topics     - Guia MQTT      ");
  Serial.println("  [m] Menu       - Mostrar esto   ");
  Serial.println("---------------------------------");
  Serial.print("  Modo actual: ");
  print_mode_name();
  Serial.println("");
  Serial.print("  > ");
}
