#include "led_driver.h"
#include "../../config.h"

static bool lora_blink_active = false;
static unsigned long lora_blink_start = 0;
static const unsigned long LORA_BLINK_DURATION = 200;

void node_led_init() {
  pinMode(LED_ROJO, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AZUL, OUTPUT);

  digitalWrite(LED_ROJO, LOW);
  digitalWrite(LED_VERDE, HIGH);
  digitalWrite(LED_AZUL, LOW);

  Serial.println("LEDs init: R=" + String(LED_ROJO) +
                 " V=" + String(LED_VERDE) +
                 " A=" + String(LED_AZUL));
}

void node_led_lleno_on()  { digitalWrite(LED_ROJO, HIGH); }
void node_led_lleno_off() { digitalWrite(LED_ROJO, LOW); }

void node_led_disponible_on()  { digitalWrite(LED_VERDE, HIGH); }
void node_led_disponible_off() { digitalWrite(LED_VERDE, LOW); }

void node_led_lora_on()  {
  lora_blink_active = false;
  digitalWrite(LED_AZUL, HIGH);
}
void node_led_lora_off() {
  lora_blink_active = false;
  digitalWrite(LED_AZUL, LOW);
}

void node_led_lora_blink() {
  lora_blink_active = true;
  lora_blink_start = millis();
  digitalWrite(LED_AZUL, HIGH);
}

void node_led_update(uint16_t tof_mm) {
  unsigned long now = millis();

  // Tanque lleno: LED Rojo
  if (tof_mm > 0 && tof_mm < FULL_THRESHOLD_MM) {
    node_led_lleno_on();
    node_led_disponible_off();
  } else {
    node_led_lleno_off();
    node_led_disponible_on();
  }

  // LoRa blink no bloqueante
  if (lora_blink_active && (now - lora_blink_start >= LORA_BLINK_DURATION)) {
    digitalWrite(LED_AZUL, LOW);
    lora_blink_active = false;
  }
}
