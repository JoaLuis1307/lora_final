#include "mq135_driver.h"
#include "../../config.h"

void mq135_init() {
  pinMode(MQ135_PIN, INPUT);
  analogReadResolution(12);
  Serial.println("MQ135 iniciado");
}

int mq135_read_raw() {
  return analogRead(MQ135_PIN);
}

float mq135_read_voltage() {
  int raw = analogRead(MQ135_PIN);
  return (raw / 4095.0) * 3.3;
}
