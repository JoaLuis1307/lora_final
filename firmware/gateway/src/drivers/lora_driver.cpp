#include "lora_driver.h"
#include "../../config.h"

bool lora_alive = false;
int lora_last_rssi = 0;
float lora_last_snr = 0;

static float lora_freq_hz = LORA_FREQ;

// Aplica los parametros de radio comunes. Se usa tanto en el arranque como
// cada vez que el SX1278 se recupera, para no quedarnos con valores por defecto.
static void lora_apply_config() {
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH_HZ);
  LoRa.setCodingRate4(LORA_CODING_RATE);
  LoRa.setTxPower(constrain(LORA_TX_POWER_DBM, 2, 17)); // SX1278 PA_BOOST
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setPreambleLength(LORA_PREAMBLE_LENGTH);
  LoRa.enableCrc(); // CRC de radio ademas del CRC-8 de aplicacion
}

void lora_init(float freq_hz) {
  // El SX1278 cubre 137-525 MHz; el modulo de 433 MHz se usa en 410-525 MHz.
  if (freq_hz < (float)LORA_FREQ_MIN_MHZ * 1000000.0f ||
      freq_hz > (float)LORA_FREQ_MAX_MHZ * 1000000.0f) {
    Serial.println("LoRa: frecuencia fuera de rango, usando 433 MHz");
    freq_hz = LORA_FREQ;
  }
  lora_freq_hz = freq_hz;

  SPI.begin(LORA_SPI_SCK, LORA_SPI_MISO, LORA_SPI_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

  if (!LoRa.begin(lora_freq_hz)) {
    Serial.println("Fallo LoRa (verifique alimentacion 3.3V, SPI y pines NSS/RST)");
    lora_alive = false;
    return;
  }
  lora_alive = true;
  lora_apply_config();
  LoRa.receive(); // modo RX continuo: el gateway debe quedar siempre escuchando
  Serial.print("LoRa OK @ ");
  Serial.print(lora_freq_hz / 1000000.0f, 3);
  Serial.print(" MHz  SF");
  Serial.print(LORA_SPREADING_FACTOR);
  Serial.print(" BW");
  Serial.print(LORA_BANDWIDTH_HZ / 1000);
  Serial.print("k CR4/");
  Serial.print(LORA_CODING_RATE);
  Serial.print(" TX");
  Serial.print(LORA_TX_POWER_DBM);
  Serial.println("dBm");
}

void lora_check() {
  static unsigned long last = 0;
  unsigned long now = millis();
  if (now - last < LORA_CHECK_INTERVAL) return;
  last = now;

  // LoRa.random() lee el registro 0x2C (RSSI wideband), que solo es valido en
  // modo FSK: en modo LoRa puede devolver 0 y provocar reinicios falsos cada
  // 3 segundos. Es mejor comprobar un registro LoRa real: si el SPI responde,
  // ModemConfig2 devuelve el SF configurado.
  bool dead = (LoRa.getSpreadingFactor() != LORA_SPREADING_FACTOR);
  if (dead) {
    if (lora_alive) {
      Serial.println("LoRa no responde, reintentando...");
    }
    LoRa.end();
    // LoRa.end() cierra el bus SPI. Volver a inicializarlo con los pines del
    // gateway evita que begin() use los pines por defecto de la placa.
    SPI.begin(LORA_SPI_SCK, LORA_SPI_MISO, LORA_SPI_MOSI, LORA_CS);
    lora_alive = LoRa.begin(lora_freq_hz);
    if (lora_alive) {
      lora_apply_config();
      LoRa.receive();
      Serial.println("LoRa recuperado");
    }
    else Serial.println("LoRa sigue fallando");
  } else {
    lora_alive = true;
  }
}

bool lora_send(const uint8_t* data, size_t len) {
  if (!lora_alive || data == nullptr || len == 0) return false;
  if (len > LORA_MAX_PAYLOAD) {
    Serial.print("LoRa TX abortado: payload ");
    Serial.print(len);
    Serial.print(" bytes > limite SX1278 (");
    Serial.print(LORA_MAX_PAYLOAD);
    Serial.println(")");
    return false;
  }

  LoRa.beginPacket();
  size_t written = LoRa.write(data, len);
  bool ok = false;
  if (written == len) {
    ok = LoRa.endPacket();
  } else {
    // No enviar un paquete truncado: el CRC del nodo ya no cuadraria.
    LoRa.idle();
    Serial.println("LoRa TX abortado: escritura incompleta");
  }

  // Tras transmitir el SX1278 queda en standby. Volver a RX continuo para no
  // perder la siguiente telemetria mientras se responde el ACK.
  LoRa.receive();
  return ok;
}

int lora_available() {
  return LoRa.parsePacket();
}

int lora_read() {
  return LoRa.read();
}

String lora_read_string() {
  String msg;
  while (LoRa.available()) {
    msg += (char)LoRa.read();
  }
  lora_last_rssi = LoRa.packetRssi();
  lora_last_snr = LoRa.packetSnr();
  return msg;
}
