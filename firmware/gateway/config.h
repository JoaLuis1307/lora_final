#ifndef CONFIG_H
#define CONFIG_H

// WiFi
#define WIFI_SSID       "LIZBETH_CASA 2.4"
#define WIFI_PASSWORD   "@siul1307982026"

// MQTT
#define MQTT_SERVER        "145.79.1.173"
#define MQTT_PORT          1883
#define MQTT_USER          "iotuser"
#define MQTT_PASS          "130798"
#define MQTT_CLIENT_ID     "ESP32S3_Gateway_01"
#define MQTT_GATEWAY_ID    "gateway_01"
#define MQTT_TOPIC_STATUS  "lora/gateway_01/status"
#define MQTT_TOPIC_INFO    "lora/gateway_01/info"
#define MQTT_TOPIC_STATS   "lora/gateway_01/stats"
#define MQTT_TOPIC_COMMAND   "lora/gateway_01/+/command"
#define MQTT_TOPIC_GW_CMD    "lora/gateway_01/command"
#define MQTT_TOPIC_ACK       "lora/gateway_01/+/ack"

// OLED (I2C)
#define OLED_SDA        18
#define OLED_SCL        17
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_ADDR       0x3C

// LoRa (SPI)
#define LORA_CS         10
#define LORA_RST        9
#define LORA_IRQ        14
#define LORA_SPI_MOSI   11
#define LORA_SPI_MISO   13
#define LORA_SPI_SCK    12
#define LORA_FREQ       433E6

// Tiempos
#define RECONNECT_INTERVAL    5000
#define LORA_CHECK_INTERVAL   3000
#define STATUS_INTERVAL       30000

// AP Mode
#define AP_SSID             "IoT-Gateway"
#define AP_PASSWORD         "12345678"
#define AP_CHANNEL          1
#define AP_MAX_CONN         4

// Boton (doble pulsacion para activar modo AP)
// Pin 1/3 a GPIO 4, Pin 2/4 a GND (normalmente abierto)
#define BUTTON_PIN          4
#define BUTTON_DOUBLE_MS    500   // Ventana para segunda pulsacion (ms)
#define BUTTON_WAIT_MS      2000  // Max espera primera pulsacion (ms)

// Web Server
#define WEB_PORT            80

// Autenticacion Web (por defecto, se guardan en NVS)
#define WEB_DEFAULT_USER    "UNSA"
#define WEB_DEFAULT_PASS    "12345678"

// Gestion de Nodos (maximo permitido en whitelist)
#define MAX_ALLOWED_NODES   16

#endif
