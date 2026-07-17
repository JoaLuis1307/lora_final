#include "wifi_driver.h"
#include "../../config.h"
#include <Preferences.h>
#include <DNSServer.h>

static bool ap_active = false;
static bool sta_connected = false;
static String ip_addr = "";
static Preferences prefs;
static DNSServer dns_server;

// Estado del boton
static int btn_state = 0;  // 0=esperando, 1=primer pulso, 2=esperando segundo
static unsigned long btn_timer = 0;
static bool last_btn_raw = false;
static unsigned long last_btn_change = 0;

// Modo confirmacion
static bool confirm_mode = false;
static unsigned long confirm_timer = 0;

void wifi_init() {
  // Verificar si se pidio modo AP por reinicio
  prefs.begin("gw", true);
  bool ap_requested = prefs.getBool("ap_request", false);
  prefs.end();

  if (ap_requested) {
    // Borrar flag y entrar en modo AP
    prefs.begin("gw", false);
    prefs.putBool("ap_request", false);
    prefs.end();

    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD, AP_CHANNEL, 0, AP_MAX_CONN);
    ap_active = true;
    ip_addr = WiFi.softAPIP().toString();
    dns_server.start(53, "*", WiFi.softAPIP());
    Serial.println("MODO AP por peticion del usuario");
    Serial.print("WiFi: ");
    Serial.println(AP_SSID);
    Serial.print("IP: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("DNS: gateway.lora -> " + ip_addr);
    return;
  }

  // Modo normal: STA
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    sta_connected = true;
    Serial.print("\nWiFi conectado: ");
    Serial.println(WiFi.localIP());
    ip_addr = WiFi.localIP().toString();
  } else {
    Serial.println("\nFallo WiFi.");
  }
}

// === BOTON: deteccion doble pulsacion con debounce ===

void wifi_button_init() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  btn_state = 0;
  confirm_mode = false;
  last_btn_raw = false;
  last_btn_change = millis();
  Serial.print("Boton GPIO ");
  Serial.print(BUTTON_PIN);
  Serial.print(" = ");
  Serial.println(digitalRead(BUTTON_PIN));
}

// Estado estable del boton (sin delay, debounce por tiempo)
static bool read_button_stable() {
  bool raw = (digitalRead(BUTTON_PIN) == LOW);
  unsigned long now = millis();

  if (raw != last_btn_raw) {
    last_btn_change = now;
    last_btn_raw = raw;
  }

  // Necesita estar estable por 30ms
  return (now - last_btn_change > 30) && raw;
}

// Detectar pulsacion larga (3 segundos)
static bool check_long_press() {
  if (digitalRead(BUTTON_PIN) == HIGH) return false;

  unsigned long start = millis();
  while (digitalRead(BUTTON_PIN) == LOW) {
    if (millis() - start > 3000) return true;
    delay(50);
  }
  return false;
}

// Llamar desde app_loop() cada ciclo
void wifi_button_check() {
  bool pressed = read_button_stable();
  unsigned long now = millis();

  // En modo AP: detectar pulsacion larga para SALIR
  if (ap_active) {
    if (check_long_press()) {
      Serial.println("PULSACION LARGA en AP -> Saliendo...");
      prefs.begin("gw", false);
      prefs.putBool("ap_request", false);
      prefs.end();
      delay(500);
      ESP.restart();
    }
    return;
  }

  // En modo confirmacion: detectar pulsacion larga para CANCELAR
  if (confirm_mode) {
    if (check_long_press()) {
      Serial.println("PULSACION LARGA -> Cancelando confirmacion");
      confirm_mode = false;
    }
    return;
  }

  // Doble pulsacion para ENTRAR a confirmacion
  switch (btn_state) {
    case 0:  // Esperando primer pulso
      if (pressed) {
        btn_state = 1;
        btn_timer = now;
        Serial.println("Boton: pulso 1");
      }
      break;

    case 1:  // Primer pulso, esperando soltar
      if (!pressed) {
        btn_state = 2;
        btn_timer = now;
      }
      if (now - btn_timer > 800) {
        btn_state = 0;
      }
      break;

    case 2:  // Soltado, esperando segundo pulso
      if (pressed) {
        Serial.println("Boton: pulso 2 -> DOBLE PULSACION!");
        confirm_mode = true;
        confirm_timer = now;
        btn_state = 0;
      }
      if (now - btn_timer > 1500) {
        btn_state = 0;
      }
      break;
  }
}

// Esta en modo confirmacion?
bool wifi_is_confirm_mode() {
  return confirm_mode;
}

// Segundos restantes para confirmar
unsigned long wifi_confirm_remaining() {
  if (!confirm_mode) return 0;
  unsigned long elapsed = (millis() - confirm_timer) / 1000;
  if (elapsed >= 5) return 0;
  return 5 - elapsed;
}

// Confirmar entrada a modo AP (guardar flag y reiniciar)
static void request_ap_mode() {
  prefs.begin("gw", false);
  prefs.putBool("ap_request", true);
  prefs.end();
  Serial.println("Guardado flag AP -> Reiniciando...");
  delay(500);
  ESP.restart();
}

// Llamar desde app_loop() cuando esta en modo confirmacion
// Retorna true si sigue confirmado, false si cancelo
bool wifi_handle_confirm() {
  if (!confirm_mode) return false;

  unsigned long elapsed = millis() - confirm_timer;

  // Timeout 5 segundos -> cancelar
  if (elapsed > 5000) {
    Serial.println("Confirmacion cancelada (timeout)");
    confirm_mode = false;
    return false;
  }

  // Una pulsacion simple para confirmar
  if (read_button_stable()) {
    Serial.println("CONFIRMADO -> Entrando modo AP!");
    confirm_mode = false;
    request_ap_mode();
  }

  return confirm_mode;
}

bool wifi_is_connected() {
  return WiFi.status() == WL_CONNECTED;
}

void wifi_reconnect() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("WiFi reconectando...");
  WiFi.disconnect();
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifi_is_ap_active() {
  return ap_active;
}

String wifi_get_ip() {
  if (ap_active) return WiFi.softAPIP().toString();
  if (sta_connected && WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
  return "0.0.0.0";
}

String wifi_get_mode_str() {
  if (ap_active) return "AP";
  return "STA";
}

void wifi_dns_loop() {
  if (ap_active) dns_server.processNextRequest();
}
