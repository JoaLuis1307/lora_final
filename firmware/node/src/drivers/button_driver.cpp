#include "button_driver.h"
#include "../../config.h"
#include <Preferences.h>
#include <WiFi.h>

static bool ap_active = false;
static Preferences btn_prefs;

// Estado del boton
static int btn_state = 0;
static unsigned long btn_timer = 0;
static bool last_btn_raw = false;
static unsigned long last_btn_change = 0;

// Modo confirmacion
static bool confirm_mode = false;
static unsigned long confirm_timer = 0;

void node_button_init() {
  pinMode(NODE_BUTTON_PIN, INPUT_PULLUP);
  btn_state = 0;
  confirm_mode = false;
  last_btn_raw = false;
  last_btn_change = millis();
  Serial.print("Boton nodo GPIO ");
  Serial.print(NODE_BUTTON_PIN);
  Serial.print(" = ");
  Serial.println(digitalRead(NODE_BUTTON_PIN));
}

static bool read_button_stable() {
  bool raw = (digitalRead(NODE_BUTTON_PIN) == LOW);
  unsigned long now = millis();
  if (raw != last_btn_raw) {
    last_btn_change = now;
    last_btn_raw = raw;
  }
  return (now - last_btn_change > 30) && raw;
}

static bool check_long_press() {
  if (digitalRead(NODE_BUTTON_PIN) == HIGH) return false;
  unsigned long start = millis();
  while (digitalRead(NODE_BUTTON_PIN) == LOW) {
    if (millis() - start > 3000) return true;
    delay(50);
  }
  return false;
}

void node_button_check() {
  bool pressed = read_button_stable();
  unsigned long now = millis();

  if (ap_active) {
    if (check_long_press()) {
      Serial.println("PULSACION LARGA en AP -> Saliendo...");
      btn_prefs.begin("node", false);
      btn_prefs.putBool("ap_request", false);
      btn_prefs.end();
      WiFi.mode(WIFI_OFF);
      WiFi.disconnect(true);
      delay(300);
      Serial.println("WiFi apagado, reiniciando...");
      ESP.restart();
    }
    return;
  }

  if (confirm_mode) {
    if (check_long_press()) {
      Serial.println("PULSACION LARGA -> Cancelando confirmacion");
      confirm_mode = false;
    }
    return;
  }

  switch (btn_state) {
    case 0:
      if (pressed) {
        btn_state = 1;
        btn_timer = now;
        Serial.println("Nodo boton: pulso 1");
      }
      break;
    case 1:
      if (!pressed) {
        btn_state = 2;
        btn_timer = now;
      }
      if (now - btn_timer > 800) btn_state = 0;
      break;
    case 2:
      if (pressed) {
        Serial.println("Nodo boton: pulso 2 -> DOBLE PULSACION!");
        confirm_mode = true;
        confirm_timer = now;
        btn_state = 0;
      }
      if (now - btn_timer > 1500) btn_state = 0;
      break;
  }
}

bool node_button_is_confirm_mode() {
  return confirm_mode;
}

unsigned long node_button_confirm_remaining() {
  if (!confirm_mode) return 0;
  unsigned long elapsed = (millis() - confirm_timer) / 1000;
  if (elapsed >= 5) return 0;
  return 5 - elapsed;
}

bool node_button_handle_confirm() {
  if (!confirm_mode) return false;

  unsigned long elapsed = millis() - confirm_timer;
  if (elapsed > 5000) {
    Serial.println("Confirmacion cancelada (timeout)");
    confirm_mode = false;
    return false;
  }

  if (read_button_stable()) {
    Serial.println("CONFIRMADO -> Entrando modo AP!");
    confirm_mode = false;
    btn_prefs.begin("node", false);
    btn_prefs.putBool("ap_request", true);
    btn_prefs.end();
    Serial.println("Guardado flag AP -> Reiniciando...");
    delay(500);
    ESP.restart();
  }

  return confirm_mode;
}

bool node_button_in_ap_mode() {
  return ap_active;
}

void node_button_set_ap_mode(bool active) {
  ap_active = active;
}
