#include "tof_driver.h"
#include "../../config.h"

static VL53L0X tof_sensor;

// Diagnostico de la ultima lectura (se muestra en el menu de debug).
static uint16_t last_raw_mm = 0;
static uint8_t  last_status = 0xFF;
static bool     last_timeout = false;
static bool     last_rejected = false;

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

        // Perfil de largo alcance: el agua absorbe mucho el laser de 940 nm,
        // asi que se baja el umbral de tasa de senal al minimo (0.1 MCPS).
        // Con el valor por defecto (0.25 MCPS) el sensor devuelve 8190
        // ("sin objetivo") cuando el nivel esta a mas de ~1 m.
        tof_sensor.setSignalRateLimit(0.1f);

        // 200 ms de medicion mejoran la relacion senal/ruido.
        tof_sensor.setMeasurementTimingBudget(200000);

        // Modo continuo back-to-back: cada medicion empieza al terminar la
        // anterior. Antes se usaba startContinuous(100) con un presupuesto de
        // 200 ms (periodo < medicion), lo que dejaba al sensor en un estado
        // inconsistente y producia timeouts.
        tof_sensor.startContinuous();

        last_raw_mm = 0;
        last_status = 0xFF;
        last_timeout = false;
        last_rejected = false;

        Serial.println("VL53L0X OK (largo alcance, 200 ms)");
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

  last_raw_mm = raw;
  last_timeout = tof_sensor.timeoutOccurred();
  // RESULT_RANGE_STATUS[6:3] = estado del rango (0 = medicion valida).
  last_status = (tof_sensor.readReg(VL53L0X::RESULT_RANGE_STATUS) & 0x78) >> 3;
  last_rejected = false;

  if (last_timeout) {
    last_rejected = true;
    return false;
  }

  // 8190/8191 = sin objetivo (agua fuera de alcance, superficie que refleja
  // el laser fuera del receptor, etc.).
  if (raw == 0 || raw >= 8000) {
    last_rejected = true;
    return false;
  }

  // Descartar lecturas fisicamente imposibles para el montaje.
  if (raw < TOF_MIN_MM || raw > TOF_MAX_MM) {
    last_rejected = true;
    return false;
  }

  // Algunos modulos VL53L0X reportan un estado de fase no cero aunque el
  // valor en milimetros sea estable y este dentro del rango fisico. El valor
  // ya fue filtrado por timeout, objetivo ausente y limites del montaje, por
  // lo que no se descarta solo por RESULT_RANGE_STATUS.
  distance_mm = raw;
  return true;
}

void tof_debug_print() {
  Serial.print("  Crudo: ");
  Serial.print(last_raw_mm);
  Serial.print(" mm  estado: ");
  Serial.print(last_status);
  Serial.print("  timeout: ");
  Serial.print(last_timeout ? "SI" : "NO");
  if (last_raw_mm >= 8000) {
    Serial.print("  (sin objetivo / fuera de alcance)");
  } else if (last_raw_mm > 0 && last_raw_mm < TOF_MIN_MM) {
    Serial.print("  (demasiado cerca)");
  } else if (last_raw_mm > TOF_MAX_MM) {
    Serial.print("  (fuera del rango util)");
  }
  Serial.println();
}
