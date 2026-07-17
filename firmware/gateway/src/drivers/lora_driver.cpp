#include "lora_driver.h"
#include "../../config.h"

bool lora_alive = false;
int lora_last_rssi = 0;
float lora_last_snr = 0;

void lora_init() {
  SPI.begin(LORA_SPI_SCK, LORA_SPI_MISO, LORA_SPI_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("Fallo LoRa");
    lora_alive = false;
    return;
  }
  lora_alive = true;
  Serial.println("LoRa OK");
}

void lora_check() {
  static unsigned long last = 0;
  unsigned long now = millis();
  if (now - last < LORA_CHECK_INTERVAL) return;
  last = now;

  bool dead = true;
  for (int i = 0; i < 3; i++) {
    if (LoRa.random() != 0) {
      dead = false;
      break;
    }
  }
  if (dead) {
    if (lora_alive) {
      Serial.println("LoRa no responde, reintentando...");
    }
    LoRa.end();
    lora_alive = LoRa.begin(LORA_FREQ);
    if (lora_alive) Serial.println("LoRa recuperado");
    else Serial.println("LoRa sigue fallando");
  } else {
    lora_alive = true;
  }
}

bool lora_send(const uint8_t* data, size_t len) {
  LoRa.beginPacket();
  LoRa.write(data, len);
  return LoRa.endPacket();
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
