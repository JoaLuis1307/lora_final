#include "tof_driver.h"
#include "../../config.h"

static VL53L0X tof_sensor;

static bool i2c_probe(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

static void i2c_scan() {
  Serial.print("I2C scan: ");
  for (uint8_t a = 1; a < 127; a++) {
    if (i2c_probe(a)) {
      Serial.printf("0x%02X ", a);
    }
  }
  Serial.println();
}

static bool reset_i2c_bus() {
  Wire.end();
  delay(10);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  delay(20);
  return true;
}

bool tof_init() {
  reset_i2c_bus();

#ifdef TOF_XSHUT_PIN
  pinMode(TOF_XSHUT_PIN, OUTPUT);
  digitalWrite(TOF_XSHUT_PIN, LOW);
  delay(50);
  digitalWrite(TOF_XSHUT_PIN, HIGH);
  delay(500);
#else
  delay(500);
#endif

  tof_sensor.setTimeout(500);

  for (int retry = 0; retry < 3; retry++) {
    if (i2c_probe(0x29)) {
      Wire.setClock(50000);
      if (tof_sensor.init()) {
        Wire.setClock(400000);
        tof_sensor.setMeasurementTimingBudget(200000);
        tof_sensor.startContinuous(100);
        Serial.println("VL53L0X OK");
        return true;
      }
      Wire.setClock(100000);
      Serial.println("VL53L0X: init() fallo (ID incorrecto)");
    } else {
      Serial.printf("VL53L0X: 0x29 no responde (intento %d/3)\n", retry + 1);
    }

    if (retry < 2) {
      delay(500);
      reset_i2c_bus();
    }
  }

  Serial.print("VL53L0X: NO DETECTADO. ");
  i2c_scan();

  if (!i2c_probe(0x29)) {
    Serial.println("  -> El sensor no responde en 0x29.");
    Serial.println("  -> Revise:          ");
    Serial.println("     - VIN a 3.3V     ");
    Serial.println("     - GND a GND      ");
    Serial.println("     - SDA a GPIO21   ");
    Serial.println("     - SCL a GPIO22   ");
    Serial.println("     - XSHUT a 3.3V (si su modulo tiene ese pin)");
    Serial.println("  -> Agregue resistencias 4.7kΩ en SDA y SCL a 3.3V");
  }

  return false;
}

bool tof_read(uint16_t& distance_mm) {
  uint16_t raw = tof_sensor.readRangeContinuousMillimeters();

  if (tof_sensor.timeoutOccurred() || raw >= 8190) {
    return false;
  }

  distance_mm = raw;
  return true;
}
