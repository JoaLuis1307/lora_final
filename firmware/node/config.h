#ifndef CONFIG_H
#define CONFIG_H

// Identificacion del nodo
#define NODE_ID         "node_01"
#define NODE_NUM        1

// LoRa (SPI - VSPI)
#define LORA_CS         5
#define LORA_RST        14
#define LORA_IRQ        27
#define LORA_SCK        18
#define LORA_MISO       19
#define LORA_MOSI       23
#define LORA_FREQ       433E6

// I2C (VL53L0X + INA219)
#define I2C_SDA         21
#define I2C_SCL         22
#define TOF_XSHUT_PIN   13

// Sensores digitales
#define MQ135_PIN       34
#define TRIG_PIN        32
#define ECHO_PIN        33
#define IR_PIN          26

// GPS (Serial2)
#define GPS_RX          16
#define GPS_TX          17

// Tiempos
#define SEND_INTERVAL   30000
#define MIN_SEND_INTERVAL 5000

// Deep sleep
#define DEEP_SLEEP_ENABLE   0
#define SLEEP_AFTER_SEND    0
#define WAKEUP_GPIO         33
#define DEBOUNCE_MS         100

// Sensores - mascara de habilitacion por defecto (todos activos = 0x3F = 63)
#define DEFAULT_SENSOR_MASK  0x3F

// Bateria Li-ion 18650
#define BATT_CAPACITY_MAH   1600.0f
#define BATT_FULL_VOLTAGE   4.2f

// WiFi Mode: 0=Off, 1=AP, 2=STA+AP
#define DEFAULT_WIFI_MODE    1

// Boton para modo AP (GPIO 4, mismo que gateway)
// Pin 1/3 a GPIO 4, Pin 2/4 a GND (normalmente abierto)
#define NODE_BUTTON_PIN     4
#define NODE_BTN_DOUBLE_MS  500
#define NODE_BTN_WAIT_MS    2000

// WiFi AP para configuracion del nodo
#define NODE_AP_SSID        "IoT-Node-Config"
#define NODE_AP_PASS        "12345678"
#define NODE_AP_CHANNEL     1
#define NODE_AP_MAX_CONN    2
#define NODE_WEB_PORT       80

// Credenciales web del nodo (se guardan en NVS)
#define NODE_DEFAULT_USER   "UNSA"
#define NODE_DEFAULT_PASS   "12345678"

#endif
