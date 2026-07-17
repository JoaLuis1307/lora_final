#include "gateway_app.h"
#include "../../config.h"
#include "../drivers/wifi_driver.h"
#include "../drivers/lora_driver.h"
#include "../services/display_service.h"
#include "../services/mqtt_service.h"
#include "../services/router_service.h"
#include "../services/web_service.h"
#include "../services/node_store.h"

static struct {
  bool wifi;
  bool mqtt;
  bool lora;
  unsigned long last_mqtt_reconnect;
  unsigned long last_status;
  unsigned long last_info;
  unsigned long last_stats;
} state;

void app_init() {
  Serial.begin(115200);
  delay(500);

  display_service_init();

  wifi_init();
  state.wifi = wifi_is_connected();

  if (wifi_is_ap_active()) {
    display_show_ap_mode(AP_SSID, wifi_get_ip().c_str());
    delay(3000);
  } else {
    wifi_button_init();
  }

  web_service_init();

  lora_init();
  state.lora = lora_alive;

  mqtt_service_init();
  if (state.wifi) {
    state.mqtt = mqtt_reconnect();
  } else {
    state.mqtt = false;
  }

  router_init();
  display_show_status(state.wifi, state.mqtt, state.lora);
  display_show_serial_menu();
  state.last_status = millis();
  state.last_info = millis();
  state.last_stats = millis();
}

static void handle_serial() {
  if (!Serial.available()) return;
  char c = Serial.read();

  if (c == 'm' || c == 'M') {
    display_show_serial_menu();
    return;
  }

  if (c >= '0' && c <= '2') {
    display_mode = (DisplayMode)(c - '0');
    display_render();
    Serial.print("  OLED ahora muestra: ");
    switch (display_mode) {
      case DISP_STATUS:    Serial.println("Estado"); break;
      case DISP_TELEMETRY: Serial.println("Telemetria del nodo"); break;
      case DISP_SIGNAL:    Serial.println("Senal (RSSI/SNR)"); break;
      default: break;
    }
    Serial.print("  > ");
    return;
  }

  if (c == 's' || c == 'S') {
    Serial.println("");
    Serial.println("--- ESTADISTICAS ---");
    Serial.print("  Paquetes recibidos: ");
    Serial.println(router_packets);
    Serial.print("  Errores CRC: ");
    Serial.println(router_crc_errors);
    Serial.print("  Tasa error: ");
    if (router_packets > 0) {
      Serial.print((router_crc_errors * 100) / router_packets);
      Serial.println("%");
    } else {
      Serial.println("0%");
    }
    Serial.print("  > ");
    return;
  }

  if (c == 't' || c == 'T') {
    Serial.println("");
    Serial.println("========== GUIAS MQTT EXPLORER ==========");
    Serial.println("");
    Serial.println("--- SUSCRIBIRSE (leer datos) ---");
    Serial.println("  lora/gateway_01/status");
    Serial.println("  lora/gateway_01/info");
    Serial.println("  lora/gateway_01/stats");
    Serial.println("  lora/gateway_01/+/telemetry");
    Serial.println("  lora/gateway_01/+/ack");
    Serial.println("");
    Serial.println("--- PUBLICAR (enviar comandos) ---");
    Serial.println("");
    Serial.println("  GATEWAY:");
    Serial.println("  Topic: lora/gateway_01/command");
    Serial.println("  Payload: {\"display\":0}     (0=Estado, 1=Telemetria, 2=Serial)");
    Serial.println("  Payload: {\"info\":1}");
    Serial.println("  Payload: {\"stats\":1}");
    Serial.println("  Payload: {\"status\":1}");
    Serial.println("");
    Serial.println("  NODO N1:");
    Serial.println("  Topic: lora/gateway_01/N1/command");
    Serial.println("  Payload: {\"cmd\":\"ping\"}");
    Serial.println("  Payload: {\"cmd\":\"interval\",\"value\":30000}");
    Serial.println("  Payload: {\"cmd\":\"request\"}");
    Serial.println("  Payload: {\"cmd\":\"reboot\"}");
    Serial.println("");
    Serial.println("  NODO N2 (futuro):");
    Serial.println("  Topic: lora/gateway_01/N2/command");
    Serial.println("  (mismos comandos)");
    Serial.println("");
    Serial.println("--- TELEMETRIA (topic telemetry) ---");
    Serial.println("  {");
    Serial.println("    \"sequence\":1, \"battery\":3.72,");
    Serial.println("    \"air_quality\":123, \"ultrasonic_cm\":45,");
    Serial.println("    \"tof_mm\":452, \"fill_percent\":68.0, \"liters\":748,");
    Serial.println("    \"obstacle\":0, \"altitude\":0, \"satellites\":0,");
    Serial.println("    \"rssi\":-75, \"snr\":8.5, \"crc\":42");
    Serial.println("  }");
    Serial.println("");
    Serial.println("--- EJEMPLO APP/WEB ---");
    Serial.println("  GET http://api/lora/gateway_01/info");
    Serial.println("  POST http://api/lora/gateway_01/N1/command {\"cmd\":\"ping\"}");
    Serial.println("==========================================");
    Serial.print("  > ");
    return;
  }

  if (c == 'i' || c == 'I') {
    Serial.println("");
    Serial.println("--- INFO DEL SISTEMA ---");
    Serial.print("  Uptime: ");
    Serial.print(millis() / 1000);
    Serial.println(" s");
    Serial.print("  Heap libre: ");
    Serial.print(ESP.getFreeHeap());
    Serial.println(" bytes");
    Serial.print("  WiFi: ");
    Serial.println(state.wifi ? "Conectado" : "Desconectado");
    Serial.print("  MQTT: ");
    Serial.println(state.mqtt ? "Conectado" : "Desconectado");
    Serial.print("  LoRa: ");
    Serial.println(state.lora ? "Operativo" : "Fallando");
    Serial.print("  RSSI WiFi: ");
    Serial.println(WiFi.RSSI());
    Serial.print("  > ");
  }
}

void app_loop() {
  handle_serial();
  web_service_loop();
  wifi_dns_loop();

  // Verificar boton doble pulsacion
  wifi_button_check();

  // Si esta en modo confirmacion, mostrar en OLED y esperar
  static bool last_confirm = false;
  bool now_confirm = wifi_is_confirm_mode();

  if (now_confirm) {
    display_show_confirm_prompt(wifi_confirm_remaining());
    wifi_handle_confirm();
    last_confirm = true;
    return;
  }

  // Al salir de confirmacion (timeout), refrescar display
  if (last_confirm) {
    last_confirm = false;
    display_show_status(state.wifi, state.mqtt, state.lora);
  }

  bool current_wifi = wifi_is_connected();
  if (current_wifi != state.wifi) {
    state.wifi = current_wifi;
    if (!state.wifi) {
      wifi_reconnect();
      state.wifi = wifi_is_connected();
    }
    display_show_status(state.wifi, state.mqtt, state.lora);
  }

  if (state.wifi) {
    if (!mqtt_is_connected()) {
      unsigned long now = millis();
      if (now - state.last_mqtt_reconnect > RECONNECT_INTERVAL) {
        state.last_mqtt_reconnect = now;
        if (state.mqtt) {
          state.mqtt = false;
          display_show_status(state.wifi, state.mqtt, state.lora);
        }
        state.mqtt = mqtt_reconnect();
        display_show_status(state.wifi, state.mqtt, state.lora);
      }
    } else {
      if (!state.mqtt) {
        state.mqtt = true;
        display_show_status(state.wifi, state.mqtt, state.lora);
      }
      mqtt_loop();

      unsigned long now = millis();
      if (now - state.last_status > STATUS_INTERVAL) {
        state.last_status = now;
        mqtt_publish_status(true, WiFi.localIP().toString().c_str());
      }
      if (now - state.last_info > 60000) {
        state.last_info = now;
        mqtt_publish_info();
      }
      if (now - state.last_stats > 30000) {
        state.last_stats = now;
        mqtt_publish_stats(router_packets, router_crc_errors, stored_node_count);
      }
    }
  } else {
    if (state.mqtt) {
      state.mqtt = false;
      display_show_status(state.wifi, state.mqtt, state.lora);
    }
  }

  lora_check();
  if (lora_alive != state.lora) {
    state.lora = lora_alive;
    display_show_status(state.wifi, state.mqtt, state.lora);
    if (state.mqtt) {
      mqtt_publish_status(state.lora, WiFi.localIP().toString().c_str());
    }
  }

  router_loop();
}
