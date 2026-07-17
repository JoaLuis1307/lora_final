#include "gps_driver.h"
#include "../../config.h"

TinyGPSPlus gps;

void gps_init() {
  Serial2.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("GPS NEO-6M iniciado");
}

void gps_update() {
  while (Serial2.available()) {
    gps.encode(Serial2.read());
  }
}
