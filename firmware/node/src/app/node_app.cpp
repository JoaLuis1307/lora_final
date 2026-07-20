#include "node_app.h"
#include "../../config.h"
#include "../drivers/lora_driver.h"
#include "../drivers/led_driver.h"
#include "../drivers/mq135_driver.h"
#include "../drivers/ultrasonic_driver.h"
#include "../drivers/ir_driver.h"
#include "../drivers/tof_driver.h"
#include "../drivers/gps_driver.h"
#include "../drivers/ina219_driver.h"
#include "../drivers/button_driver.h"
#include "../services/sensor_service.h"
#include "../services/report_service.h"
#include "../services/command_service.h"
#include "../services/node_config_service.h"

#include <WiFi.h>

#if DEEP_SLEEP_ENABLE
#include "driver/rtc_io.h"
#endif

#include <Preferences.h>

static unsigned long last_send = 0;
static unsigned long send_jitter = 0;
static NodeMode current_mode = MODE_NORMAL;
static int single_sensor_index = 0;
static bool menu_dirty = true;
static bool ap_mode = false;
static Preferences app_prefs;

// Deep sleep
#if DEEP_SLEEP_ENABLE
static void enter_deep_sleep() {
  Serial.println("=== ENTERING DEEP SLEEP ===");
  Serial.flush();

  // Configurar wakeup por timer (usa intervalo configurable)
  esp_sleep_enable_timer_wakeup((uint64_t)node_config_get_interval() * 1000ULL);

  // Configurar wakeup por GPIO (boton)
  esp_sleep_enable_ext0_wakeup((gpio_num_t)WAKEUP_GPIO, 0);

  // Dormir
  esp_deep_sleep_start();
}

static void print_wake_reason() {
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  switch (cause) {
    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("Despertado por TIMER");
      break;
    case ESP_SLEEP_WAKEUP_EXT0:
      Serial.println("Despertado por BOTON");
      break;
    default:
      Serial.println("Encendido normal (power-on/reset)");
      break;
  }
}
#endif

static const char* sensor_names[] = {
  "INA219", "MQ135", "HC-SR04", "HW-201 IR", "VL53L0X", "NEO-6M GPS"
};

static void print_menu() {
  Serial.println();
  Serial.println("=================================");
  Serial.println("    NODE MENU - SELECCIONE MODO  ");
  Serial.println("=================================");
  Serial.println("  [0] Normal  - Envio LoRa periodico");
  Serial.println("  [1] Debug   - Leer todos los sensores");
  Serial.println("  [2] Sensor  - Monitorear un sensor");
  Serial.println("---------------------------------");
  Serial.print("  Modo actual: ");
  switch (current_mode) {
    case MODE_NORMAL:     Serial.print("Normal"); break;
    case MODE_DEBUG_ALL:  Serial.print("Debug todos"); break;
    case MODE_DEBUG_SINGLE:
      Serial.print("Sensor: ");
      Serial.print(sensor_names[single_sensor_index]);
      break;
    default: break;
  }
  Serial.println();
  Serial.print("  > ");
}

static void print_sensor_menu() {
  Serial.println();
  Serial.println("--- SELECCIONE SENSOR ---");
  for (int i = 0; i < 6; i++) {
    Serial.print("  [");
    Serial.print(i);
    Serial.print("] ");
    Serial.println(sensor_names[i]);
  }
  Serial.println("  [m] Volver al menu principal");
  Serial.print("  > ");
}

static void read_and_print_ina219() {
  float v = 0, c = 0, p = 0;
  if (sensor_healthy[SENSOR_INA219]) {
    ina219_read(v, c, p);
    Serial.print("  Voltaje: "); Serial.print(v, 2); Serial.println(" V");
    Serial.print("  Corriente: "); Serial.print(c, 1); Serial.println(" mA");
    Serial.print("  Potencia: "); Serial.print(p, 0); Serial.println(" mW");
  } else {
    Serial.println("  INA219: SIN DATOS");
  }
}

static void read_and_print_mq135() {
  if (sensor_healthy[SENSOR_MQ135]) {
    int val = mq135_read_raw();
    Serial.print("  Air Quality (raw): "); Serial.println(val);
  } else {
    Serial.println("  MQ135: SIN DATOS");
  }
}

static void read_and_print_ultra() {
  if (sensor_healthy[SENSOR_ULTRA]) {
    float d = ultra_read_cm();
    Serial.print("  Distancia: "); Serial.print(d, 1); Serial.println(" cm");
  } else {
    Serial.println("  HC-SR04: SIN DATOS");
  }
}

static void read_and_print_ir() {
  if (sensor_healthy[SENSOR_IR]) {
    bool obs = ir_obstacle_detected();
    Serial.print("  Obstaculo: "); Serial.println(obs ? "SI" : "NO");
  } else {
    Serial.println("  HW-201: SIN DATOS");
  }
}

static void read_and_print_tof() {
  if (sensor_healthy[SENSOR_TOF]) {
    uint16_t mm = 0;
    if (tof_read(mm)) {
      float cm = mm / 10.0f;
      Serial.print("  Distancia: "); Serial.print(cm, 1); Serial.println(" cm");
    } else {
      Serial.println("  VL53L0X: LECTURA INVALIDA");
    }
  } else {
    Serial.println("  VL53L0X: SIN DATOS");
  }
}

static void read_and_print_gps() {
  gps_update();
  if (sensor_healthy[SENSOR_GPS] && gps.location.isValid()) {
    Serial.print("  Lat: "); Serial.print(gps.location.lat(), 6);
    Serial.print("  Lon: "); Serial.print(gps.location.lng(), 6);
    Serial.print("  Alt: "); Serial.print(gps.altitude.meters(), 1); Serial.print(" m");
    Serial.print("  Sats: "); Serial.println(gps.satellites.value());
  } else {
    Serial.println("  GPS: SIN DATOS");
  }
}

static void debug_all_sensors() {
  Serial.println("--- LECTURA DE TODOS LOS SENSORES ---");
  read_and_print_ina219();
  read_and_print_mq135();
  read_and_print_ultra();
  read_and_print_ir();
  read_and_print_tof();
  read_and_print_gps();
  Serial.println("-------------------------------------");
}

static void debug_single_sensor() {
  switch (single_sensor_index) {
    case 0: read_and_print_ina219(); break;
    case 1: read_and_print_mq135(); break;
    case 2: read_and_print_ultra(); break;
    case 3: read_and_print_ir(); break;
    case 4: read_and_print_tof(); break;
    case 5: read_and_print_gps(); break;
  }
}

static void handle_serial() {
  if (!Serial.available()) return;
  char c = Serial.read();

  if (current_mode == MODE_DEBUG_SINGLE && c >= '0' && c <= '5') {
    single_sensor_index = c - '0';
    Serial.print("  Sensor cambiado a: ");
    Serial.println(sensor_names[single_sensor_index]);
    return;
  }

  if (current_mode == MODE_DEBUG_SINGLE && (c == 'm' || c == 'M')) {
    current_mode = MODE_NORMAL;
    menu_dirty = true;
    return;
  }

  if (c == 'm' || c == 'M') {
    menu_dirty = true;
    return;
  }

  if (c >= '0' && c <= '2') {
    current_mode = (NodeMode)(c - '0');
    if (current_mode == MODE_DEBUG_SINGLE) {
      single_sensor_index = 0;
      print_sensor_menu();
    } else {
      menu_dirty = true;
    }
  }
}

void app_init() {
  Serial.begin(115200);
  delay(500);

  // Seed RNG con ruido del ADC para jitter unico por nodo
  randomSeed(esp_random());
  send_jitter = random(0, 3000);
  Serial.print("Jitter de envio: ");
  Serial.print(send_jitter);
  Serial.println("ms");

  Serial.println("--- NODE FIRMWARE ---");

  node_led_init();

  // Cargar configuracion desde NVS
  node_config_load();
  Serial.print("Node ID: ");
  Serial.println(node_config_get_id());
  Serial.print("Intervalo: ");
  Serial.print(node_config_get_interval());
  Serial.println("ms");

  // Inicializar LoRa y sensores SIEMPRE (necesarios en modo AP y normal)
  lora_init();
  if (lora_ready) node_led_lora_on();
  sensor_init();
  sensor_set_mask(node_config_get_sensor_mask());

  // Verificar si se pidio modo AP por reinicio
  app_prefs.begin("node", true);
  bool ap_requested = app_prefs.getBool("ap_request", false);
  app_prefs.end();

  if (ap_requested) {
    app_prefs.begin("node", false);
    app_prefs.putBool("ap_request", false);
    app_prefs.end();

    Serial.println("=== MODO CONFIGURACION ACTIVADO ===");
    node_button_set_ap_mode(true);
    node_config_start_ap();
    ap_mode = true;
    Serial.println("Conectese a: " + String(NODE_AP_SSID));
    Serial.println("IP: 192.168.4.1");
    Serial.println("Use el boton LARGO (3s) para salir");
    return;
  }

  // Modo normal: WiFi apagado, solo LoRa
  WiFi.mode(WIFI_OFF);
  WiFi.disconnect(true);

  #if DEEP_SLEEP_ENABLE
  print_wake_reason();
  rtc_gpio_pullup_en((gpio_num_t)WAKEUP_GPIO);
  Serial.print("Deep sleep: ACTIVADO (GPIO ");
  Serial.print(WAKEUP_GPIO);
  Serial.println(" wakeup)");
  #else
  Serial.println("Deep sleep: DESACTIVADO");
  #endif

  // Inicializar boton
  node_button_init();

  Serial.println("--- LECTURA INICIAL SENSORES ---");
  for (int r = 0; r < 5; r++) {
    sensor_update();
    delay(200);
  }
  debug_all_sensors();
  Serial.println("-------------------------------");
  Serial.println();

  report_init();
  command_init();

  print_menu();
}

void app_loop() {
  unsigned long now = millis();

  // Si estamos en modo AP, atender web server, boton, sensores Y enviar LoRa
  if (ap_mode) {
    node_config_web_loop();
    node_button_check();
    sensor_update();
    command_check();

    SensorData led_d = sensor_read_all();
    node_led_update(led_d.tof_mm);

    // Enviar datos LoRa periodicamente incluso en modo AP
    if (now - last_send >= (unsigned long)node_config_get_interval() + send_jitter) {
      last_send = now;
      send_jitter = random(0, 3000);
      report_send();
      node_led_lora_blink();
    }
    return;
  }

  // Verificar boton para entrar a modo confirmacion
  node_button_check();

  if (node_button_is_confirm_mode()) {
    unsigned long remaining = node_button_confirm_remaining();
    static unsigned long last_print = 0;
    if (now - last_print > 1000) {
      last_print = now;
      Serial.print("MODO CONFIG? Confirme con pulsacion simple (");
      Serial.print(remaining);
      Serial.println("s restantes)");
      Serial.println("  Largo (3s) = Cancelar");
    }
    node_button_handle_confirm();
    return;
  }

  sensor_update();
  command_check();
  handle_serial();

  SensorData led_d = sensor_read_all();
  node_led_update(led_d.tof_mm);

  if (menu_dirty) {
    menu_dirty = false;
    print_menu();
  }

  switch (current_mode) {
    case MODE_NORMAL:
      if (now - last_send >= command_get_interval() + send_jitter) {
        last_send = now;
        send_jitter = random(0, 3000);
        report_send();
        node_led_lora_blink();

        #if DEEP_SLEEP_ENABLE && SLEEP_AFTER_SEND
        Serial.println("Datos enviados, entrando en deep sleep...");
        delay(100);
        enter_deep_sleep();
        #endif
      }
      break;

    case MODE_DEBUG_ALL:
      if (now - last_send >= 3000) {
        last_send = now;
        debug_all_sensors();
      }
      break;

    case MODE_DEBUG_SINGLE:
      if (now - last_send >= 1000) {
        last_send = now;
        debug_single_sensor();
      }
      break;
  }
}
