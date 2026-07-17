#include "lora_driver.h"
#include "../../config.h"

bool lora_ready = false;
float lora_last_rssi = 0;
float lora_last_snr = 0;
float lora_noise_floor = 0;
unsigned long lora_tx_count = 0;
unsigned long lora_rx_count = 0;

void lora_init() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

  lora_ready = LoRa.begin(LORA_FREQ);
  if (lora_ready) {
    Serial.println("LoRa OK");
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
  LoRa.idle();
  return -164.0 + raw;
}

static bool lora_channel_clear() {
  LoRa.receive();
  delayMicroseconds(100);
  if (LoRa.parsePacket() > 0) return false;
  LoRa.idle();
  return true;
}

bool lora_send(const String& data) {
  if (!lora_ready) return false;
  LoRa.beginPacket();
  LoRa.print(data);
  bool ok = LoRa.endPacket();
  if (ok) lora_tx_count++;
  LoRa.receive();
  return ok;
}

bool lora_send_with_retries(const String& data, int max_retries) {
  for (int attempt = 0; attempt <= max_retries; attempt++) {
    for (int wait = 0; wait < 5; wait++) {
      if (lora_channel_clear()) break;
      int backoff = random(50, 200);
      delay(backoff);
    }

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
