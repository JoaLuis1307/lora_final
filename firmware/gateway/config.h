#ifndef CONFIG_H
#define CONFIG_H

// WiFi
#define WIFI_SSID       "LIZBETH_CASA 2.4"
#define WIFI_PASSWORD   "@siul1307982026"

// MQTT
#define MQTT_SERVER        "179.197.88.129"
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
// El SX1278 tiene un FIFO de 256 bytes: la libreria LoRa permite 255 como maximo.
#define LORA_MAX_PAYLOAD       255
#define LORA_FREQ       433E6
#define LORA_SPREADING_FACTOR  7
#define LORA_BANDWIDTH_HZ      125000
#define LORA_CODING_RATE       5
// PA_BOOST del SX1278 sin PA_DAC: 2..17 dBm. No subir de 17 si el modulo no
// tiene PA_DAC habilitado (la mayoria de placas SX1278 declaran 20 dBm max.).
#define LORA_TX_POWER_DBM      17
// Red privada LoRa (valor por defecto de la libreria). Nodo y gateway deben coincidir.
#define LORA_SYNC_WORD         0x12
#define LORA_PREAMBLE_LENGTH   8
// Rango del SX1278. El modulo de 433 MHz esta sintonizado para 410-525 MHz.
#define LORA_FREQ_MIN_MHZ      410
#define LORA_FREQ_MAX_MHZ      525

// 0: descarta la telemetria con CRC invalido (recomendado).
// 1: la publica igualmente con "crc_ok":0 para diagnostico.
#define LORA_PUBLISH_CRC_ERRORS 0

// 0: publica nodos validos para permitir descubrimiento automatico.
// 1: solo publica nodos registrados en la whitelist.
#define LORA_REQUIRE_WHITELIST 0

// Tiempos
#define RECONNECT_INTERVAL    5000
#define LORA_CHECK_INTERVAL   3000
#define STATUS_INTERVAL       30000

// PubSubClient necesita espacio para topic + payload + cabecera MQTT.
// La telemetria JSON (con GPS y todos los campos de bateria) ronda 600 bytes;
// con 512 el publish fallaba en silencio. 1024 deja margen suficiente.
#define MQTT_BUFFER_SIZE      1024

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

// LEDs indicadores
#define LED_ROJO            2   // Error de red/conectividad
#define LED_AZUL1           3   // Estado del sistema (ON/OFF)
#define LED_AZUL2           5   // Actividad LoRa Radio

// Web Server
#define WEB_PORT            80

// Gestion de Nodos (maximo permitido en whitelist)
#define MAX_ALLOWED_NODES   16

#endif
