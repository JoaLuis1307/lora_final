#include "led_driver.h"
#include "../../config.h"

static bool mqtt_blink_active = false;
static unsigned long mqtt_blink_start = 0;
static const unsigned long MQTT_BLINK_DURATION = 150;

static bool lora_blink_active = false;
static unsigned long lora_blink_start = 0;
static const unsigned long LORA_BLINK_DURATION = 200;

void led_init() {
  pinMode(LED_ROJO, OUTPUT);
  pinMode(LED_AZUL1, OUTPUT);
  pinMode(LED_AZUL2, OUTPUT);

  digitalWrite(LED_ROJO, LOW);
  digitalWrite(LED_AZUL1, LOW);
  digitalWrite(LED_AZUL2, LOW);

  Serial.println("LEDs init: R=" + String(LED_ROJO) +
                 " B1(MQTT)=" + String(LED_AZUL1) +
                 " B2(LoRa)=" + String(LED_AZUL2));
}

// === LED ROJO: Error de red ===
void led_rojo_on() {
  digitalWrite(LED_ROJO, HIGH);
}

void led_rojo_off() {
  digitalWrite(LED_ROJO, LOW);
}

// === LED AZUL 1: Actividad MQTT ===
void led_mqtt_activity() {
  mqtt_blink_active = true;
  mqtt_blink_start = millis();
  digitalWrite(LED_AZUL1, HIGH);
}

void led_mqtt_off() {
  mqtt_blink_active = false;
  digitalWrite(LED_AZUL1, LOW);
}

// === LED AZUL 2: Actividad LoRa ===
void led_lora_activity() {
  lora_blink_active = true;
  lora_blink_start = millis();
  digitalWrite(LED_AZUL2, HIGH);
}

void led_lora_off() {
  lora_blink_active = false;
  digitalWrite(LED_AZUL2, LOW);
}

// === Actualizacion no bloqueante ===
void led_blink_update() {
  unsigned long now = millis();

  if (mqtt_blink_active && (now - mqtt_blink_start >= MQTT_BLINK_DURATION)) {
    digitalWrite(LED_AZUL1, LOW);
    mqtt_blink_active = false;
  }

  if (lora_blink_active && (now - lora_blink_start >= LORA_BLINK_DURATION)) {
    digitalWrite(LED_AZUL2, LOW);
    lora_blink_active = false;
  }
}
