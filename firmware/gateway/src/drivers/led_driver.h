#ifndef LED_DRIVER_H
#define LED_DRIVER_H

#include <Arduino.h>

// LED Rojo: Error de red
//   OFF  = Red OK
//   ON   = Error de conexion
void led_rojo_on();
void led_rojo_off();

// LED Azul 1: Actividad MQTT
//   Parpadeo rapido = Enviando/Recibiendo datos MQTT
//   OFF             = Sin actividad MQTT
void led_mqtt_activity();
void led_mqtt_off();

// LED Azul 2: Actividad LoRa Radio
//   Parpadeo = Transmitiendo/Recibiendo datos
//   OFF     = Sin actividad LoRa
void led_lora_activity();
void led_lora_off();

// Inicializar todos los LEDs
void led_init();

// Parpadeo no bloqueante (llamar en loop)
void led_blink_update();

#endif
