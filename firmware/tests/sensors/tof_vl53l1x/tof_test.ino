#include <Wire.h>
#include <VL53L0X.h>

VL53L0X tof;

const int OFFSET_MM = 0;  // ajusta si hay desplazamiento

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.setClock(400000);

  tof.setTimeout(500);
  if (!tof.init()) {
    Serial.println("ERROR: VL53L0X no encontrado");
    while (1);
  }

  tof.setMeasurementTimingBudget(200000);
  tof.startContinuous(100);
  Serial.println("VL53L0X listo\n");
}

void loop() {
  uint16_t raw = tof.readRangeContinuousMillimeters();

  if (tof.timeoutOccurred() || raw >= 8190) {
    Serial.println("Fuera de rango");
  } else {
    float d = (raw - OFFSET_MM) / 10.0;
    if (d < 0) d = 0;

    Serial.print("Distancia: ");
    Serial.print(d, 1);  // 1 decimal
    Serial.println(" cm");
  }

  delay(5000);
}