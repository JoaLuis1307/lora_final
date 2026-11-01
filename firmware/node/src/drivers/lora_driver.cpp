#include "lora_driver.h"
#include "../../config.h"

bool lora_ready = false;
float lora_last_rssi = 0;
float lora_last_snr = 0;
float lora_noise_floor = 0;
unsigned long lora_tx_count = 0;
unsigned long lora_rx_count = 0;

void lora_init(float freq_hz) {
  // El SX1278 cubre 137-525 MHz; el modulo de 433 MHz se usa en 410-525 MHz.
  if (freq_hz < (float)LORA_FREQ_MIN_MHZ * 1000000.0f ||
      freq_hz > (float)LORA_FREQ_MAX_MHZ * 1000000.0f) {
    Serial.println("LoRa: frecuencia fuera de rango, usando 433 MHz");
    freq_hz = LORA_FREQ;
  }

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

  lora_ready = LoRa.begin(freq_hz);
  if (lora_ready) {
    LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
    LoRa.setSignalBandwidth(LORA_BANDWIDTH_HZ);
    LoRa.setCodingRate4(LORA_CODING_RATE);
    LoRa.setTxPower(constrain(LORA_TX_POWER_DBM, 2, 17)); // SX1278 PA_BOOST
    LoRa.setSyncWord(LORA_SYNC_WORD);
    LoRa.setPreambleLength(LORA_PREAMBLE_LENGTH);
    LoRa.enableCrc(); // CRC de radio ademas del CRC-8 de aplicacion
    LoRa.receive(); // quedar a la escucha de comandos/ACK del gateway
    Serial.print("LoRa OK @ ");
    Serial.print(freq_hz / 1000000.0f, 3);
    Serial.println(" MHz");
  } else {
    Serial.println("LoRa fallo");
  }
}

float lora_read_noise() {
  if (!lora_ready) return -127;
  LoRa.receive();
  delayMicroseconds(500);
  digitalWrite(LORA_CS, LOW);
  SPI.transfer(0x1A & 0x7F);
  uint8_t raw = SPI.transfer(0);
  digitalWrite(LORA_CS, HIGH);
  // No dejar la radio en idle: volver a RX para no perder comandos.
  LoRa.receive();
  return -164.0 + raw;
}

bool lora_send(const String& data) {
  if (!lora_ready) return false;
  if (data.length() == 0) return false;
  if (data.length() > LORA_MAX_PAYLOAD) {
    Serial.print("LoRa TX abortado: payload ");
    Serial.print(data.length());
    Serial.print(" bytes > limite SX1278 (");
    Serial.print(LORA_MAX_PAYLOAD);
    Serial.println(")");
    return false;
  }

  LoRa.beginPacket();
  size_t written = LoRa.write((const uint8_t*)data.c_str(), data.length());
  bool ok = false;
  if (written == data.length()) {
    ok = LoRa.endPacket();
  } else {
    LoRa.idle();
    Serial.println("LoRa TX abortado: escritura incompleta");
  }
  if (ok) lora_tx_count++;
  LoRa.receive();
  return ok;
}

bool lora_send_with_retries(const String& data, int max_retries) {
  // No se sondea el canal con parsePacket(): eso podria consumir un comando
  // pendiente del gateway. Solo se reintenta con espera aleatoria.
  for (int attempt = 0; attempt <= max_retries; attempt++) {
    if (lora_send(data)) return true;

    if (attempt < max_retries) {
      int backoff = random(100, 500) * (attempt + 1);
      Serial.print("  -> LoRa reenvio #");
      Serial.print(attempt + 1);
      Serial.print(" en ");
      Serial.print(backoff);
      Serial.println("ms");
      delay(backoff);
    }
  }
  return false;
}

int lora_available() {
  return LoRa.parsePacket();
}

String lora_read_string() {
  String msg;
  while (LoRa.available()) {
    msg += (char)LoRa.read();
  }
  lora_last_rssi = LoRa.packetRssi();
  lora_last_snr = LoRa.packetSnr();
  lora_rx_count++;
  return msg;
}
