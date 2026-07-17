#include "ir_driver.h"
#include "../../config.h"

void ir_init() {
  pinMode(IR_PIN, INPUT);
  Serial.println("HW-201 IR iniciado");
}

bool ir_obstacle_detected() {
  return digitalRead(IR_PIN) == LOW;
}
