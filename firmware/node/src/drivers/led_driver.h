#ifndef NODE_LED_DRIVER_H
#define NODE_LED_DRIVER_H

#include <Arduino.h>

// Inicializar LEDs
void node_led_init();

// LED Rojo: Tanque lleno
void node_led_lleno_on();
void node_led_lleno_off();

// LED Verde: Tanque disponible
void node_led_disponible_on();
void node_led_disponible_off();

// LED Azul: LoRa conectado
void node_led_lora_on();
void node_led_lora_off();
void node_led_lora_blink();

// Actualizar LEDs segun nivel del tanque y estado LoRa
// tof_mm = distancia medida en mm (menor = mas lleno)
void node_led_update(uint16_t tof_mm);

#endif
