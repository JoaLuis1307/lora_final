# ESP32 OLED MQTT -- Sistema de Monitoreo de Contenedores

Sistema de telemetria para contenedores de basura con sensores ambientales y de llenado. Los nodos ESP32 leen sensores y envian datos via LoRa a un gateway, que los publica en MQTT.

---

## Arquitectura General

```
[Sensores] --> [Nodo ESP32] ---[LoRa 433 MHz]--> [Gateway ESP32] ---[MQTT]--> [Broker]
                                                       |
                                                   [OLED display]
```

El sistema tiene tres componentes principales:

- **Nodo** -- Dispositivo de campo con sensores, conectado via LoRa
- **Gateway** -- Puente LoRa a MQTT con display OLED
- **Simulador** -- Aplicacion Python que emula nodos via MQTT directo

---

## Componentes

### Nodo (node/)

Microcontrolador ESP32 con los siguientes sensores:

| Sensor | Variable | Interfaz |
|--------|----------|----------|
| DHT11 | Temperatura, Humedad | GPIO |
| MQ135 | Calidad del aire (CO2) | ADC |
| HC-SR04 | Distancia ultrasonido | GPIO |
| HW-201 IR | Obstaculo (binario) | GPIO |
| VL53L0X | Distancia TOF (cm) | I2C |
| NEO-6M GPS | Latitud, Longitud, Altitud, Satelites | UART |
| SX1278 | LoRa 433 MHz | SPI |

### Gateway (gateway/)

Microcontrolador ESP32 que recibe datos LoRa y los publica a MQTT:

| Componente | Funcion | Interfaz |
|------------|---------|----------|
| SX1278 | LoRa 433 MHz RX/TX | SPI |
| SSD1306 | OLED 128x64 | I2C |
| WiFi | Conexion a red | Interno |
| PubSubClient | Cliente MQTT | Software |

### Simulador (simulator/)

Aplicacion Python con interfaz grafica Tkinter que emula nodos reales y publica directamente a MQTT (sin LoRa).

---

## Pinout

### Nodo

| GPIO | Periferico |
|------|------------|
| 5 | LoRa CS |
| 14 | LoRa RST |
| 27 | LoRa IRQ |
| 18 | LoRa SCK |
| 19 | LoRa MISO |
| 23 | LoRa MOSI |
| 13 | VL53L0X XSHUT |
| 21 | I2C SDA (VL53L0X) |
| 22 | I2C SCL (VL53L0X) |
| 25 | DHT11 |
| 34 | MQ135 (ADC) |
| 32 | HC-SR04 TRIG |
| 33 | HC-SR04 ECHO |
| 26 | HW-201 IR |
| 16 | GPS RX (Serial2) |
| 17 | GPS TX (Serial2) |

### Gateway

| GPIO | Periferico |
|------|------------|
| 10 | LoRa CS |
| 9 | LoRa RST |
| 14 | LoRa IRQ |
| 12 | LoRa SCK |
| 13 | LoRa MISO |
| 11 | LoRa MOSI |
| 18 | OLED SDA |
| 17 | OLED SCL |

---

## Protocolo de Comunicacion

### Formato compacto (LoRa -- Nodo a Gateway)

```
N{node},P{seq},T{temp},H{hum},AQ{airq},U{ultra_cm},TOF{tof_cm},IR{0|1},B{alt},S{sats},CRC{crc8}
```

**Ejemplo:**
```
N1,P1,T25,H60,AQ123,U45,TOF45,IR0,B2335,S12,CRC207
```

**Campos:**

| Codigo | Significado | Ejemplo |
|--------|-------------|---------|
| N | ID del nodo | N1 |
| P | Secuencia | P1 |
| T | Temperatura (C) | T25 |
| H | Humedad (%) | H60 |
| AQ | Calidad del aire (ADC raw) | AQ123 |
| U | Ultrasonido (cm) | U45 |
| TOF | Time-of-Flight (cm) | TOF45 |
| IR | Obstaculo (0/1) | IR0 |
| B | Altitud GPS (m) | B2335 |
| S | Satelites GPS | S12 |
| CRC | Checksum CRC-8 | CRC207 |

### Formato JSON (MQTT -- Gateway a Broker)

El gateway convierte el formato compacto a JSON:

```json
{
  "sequence": 1,
  "temperature": 25,
  "humidity": 60,
  "air_quality": 123,
  "ultrasonic_cm": 45,
  "tof_cm": 45,
  "obstacle": 0,
  "altitude": 2335,
  "satellites": 12,
  "rssi": -75,
  "snr": 8.5,
  "pkts": 150,
  "crc_ok": 1,
  "crc_err": 0
}
```

### Formato de comando (MQTT a Nodo via Gateway)

```
{node_id}|command|{json}
```

**Ejemplo:**
```
N1|command|{"cmd":"ping"}
```

**Comandos soportados:**

| Comando | Descripcion |
|---------|-------------|
| `{"cmd":"ping"}` | Verifica conectividad, respuesta ACK0 |
| `{"cmd":"reboot"}` | Reinicia el nodo, respuesta ACK2 |
| `{"cmd":"request"}` | Solicita envio inmediato, respuesta ACK3 |
| `{"cmd":"interval","value":30000}` | Cambia intervalo de reporte, respuesta ACK1 |

### Comandos de Gateway (via MQTT)

| Comando | Descripcion |
|---------|-------------|
| `{"display":1}` | Cambia modo del OLED (0=status, 1=telemetria, 2=senal) |
| `{"info":1}` | Publica informacion del sistema |
| `{"stats":1}` | Publica estadisticas de paquetes |
| `{"status":1}` | Publica estado de conexion |

---

## Topics MQTT

| Topic | Direccion | Descripcion |
|-------|-----------|-------------|
| `lora/{gateway_id}/status` | Gateway -> Broker | Estado online/offline |
| `lora/{gateway_id}/info` | Gateway -> Broker | Informacion del sistema |
| `lora/{gateway_id}/stats` | Gateway -> Broker | Estadisticas de paquetes |
| `lora/{gateway_id}/{node}/telemetry` | Gateway -> Broker | Datos de sensores |
| `lora/{gateway_id}/{node}/ack` | Gateway -> Broker | Confirmaciones del nodo |
| `lora/{gateway_id}/command` | Broker -> Gateway | Comandos al gateway |
| `lora/{gateway_id}/{node}/command` | Broker -> Gateway | Comandos a un nodo |

**Gateway IDs:**
- `gateway_01` -- Gateway hardware real
- `gateway_02` -- Simulador Python

---

## Algoritmo CRC-8

Mismo algoritmo en nodo, gateway y simulador:

```
Polinomio: 0x07
Valor inicial: 0x00
Proceso: por cada byte, XOR al CRC, luego 8 desplazamientos con polinomio
```

---

## Instalacion y uso

### Requisitos de hardware

- 2x ESP32-S3 (o cualquier ESP32)
- 2x Modulo LoRa SX1278/RFM95W 433 MHz
- 1x DHT11
- 1x MQ135
- 1x HC-SR04
- 1x HW-201 IR
- 1x VL53L0X
- 1x NEO-6M GPS
- 1x SSD1306 OLED 128x64
- Fuente de alimentacion 5V/3.3V
- Cables, protoboard, resistencias pull-up 4.7k I2C

### Librerias requeridas (Arduino IDE)

**Nodo:**
- `LoRa` by Sandeep Mistry
- `DHT sensor library` by Adafruit
- `VL53L0X` by Pololu
- `TinyGPSPlus` by Mikal Hart

**Gateway:**
- `LoRa` by Sandeep Mistry
- `PubSubClient` by Nick O'Leary
- `Adafruit SSD1306`
- `Adafruit GFX`

### Compilar y subir firmware

**Nodo:**

```
1. Abrir node/node.ino en Arduino IDE
2. Seleccionar placa: ESP32S3 Dev Module
3. Verificar y subir
4. Abrir monitor serial a 115200 baud
```

**Gateway:**

```
1. Abrir gateway/gateway.ino en Arduino IDE
2. Editar gateway/config.h con credenciales WiFi y broker MQTT
3. Seleccionar placa: ESP32S3 Dev Module
4. Verificar y subir
5. Abrir monitor serial a 115200 baud
```

### Simulador Python

```
cd simulator
pip install -r requirements.txt
python simulator.py
```

O hacer doble clic en `simulator/run.bat` (Windows).

### Test individual de sensores

Los tests estan en `tests/sensors/`:

```
tests/sensors/tof_vl53l1x/tof_test.ino    # Test standalone VL53L0X
```

Abrir en Arduino IDE, subir al ESP32 y abrir monitor serial.

---

## Menu Serial del Nodo

El nodo tiene un menu interactivo via Serial:

```
  [0] Normal     - Envio LoRa periodico
  [1] Debug      - Leer todos los sensores
  [2] Sensor     - Monitorear un sensor individual
```

En modo Sensor se puede seleccionar: DHT11, MQ135, HC-SR04, HW-201 IR, VL53L0X, NEO-6M GPS.

---

## Menu Serial del Gateway

```
  [0] Status   - Estado WiFi/MQTT/LoRa
  [1] Display  - Alternar modo de pantalla OLED
  [n] Info     - Publicar informacion del sistema
  [s] Stats    - Publicar estadisticas
```

---

## Estructura del proyecto

```
ESP32_OLED_MQTT/
  gateway/
    gateway.ino                    # Entry point gateway
    config.h                       # Configuracion (WiFi, MQTT, pines)
    src/
      app/gateway_app.cpp         # Logica principal
      drivers/
        wifi_driver.cpp           # Conexion WiFi
        lora_driver.cpp           # LoRa SX1278
        oled_driver.cpp           # Display SSD1306
      services/
        mqtt_service.cpp          # Cliente MQTT
        router_service.cpp        # Enrutamiento LoRa -> MQTT
        parser_service.cpp        # Protocolo compacto <-> JSON
        display_service.cpp       # Gestor de pantalla OLED
  node/
    node.ino                       # Entry point nodo
    config.h                       # Configuracion (pines, tiempos)
    src/
      app/node_app.cpp            # Logica principal + menu serial
      drivers/
        lora_driver.cpp           # LoRa SX1278
        dht_driver.cpp            # DHT11
        mq135_driver.cpp          # MQ135
        ultrasonic_driver.cpp     # HC-SR04
        ir_driver.cpp             # HW-201 IR
        tof_driver.cpp            # VL53L0X
        gps_driver.cpp            # NEO-6M GPS
      services/
        sensor_service.cpp        # Inicializacion y lectura de sensores
        report_service.cpp        # Generacion de payload compacto
        command_service.cpp       # Recepcion de comandos LoRa
  simulator/
    simulator.py                  # GUI de simulacion Tkinter
    config.py                     # Configuracion MQTT del simulador
    requirements.txt              # Dependencias Python
    run.bat                       # Lanzador Windows
  tests/
    sensors/
      tof_vl53l1x/
        tof_test.ino             # Test standalone VL53L0X
  README.md
```

---

## Flujo de datos completo

```
1. Nodo lee sensores (DHT11, MQ135, HC-SR04, HW-201, VL53L0X, GPS)
2. sensor_service.sensor_read_all() recolecta todos los valores
3. report_service construye payload compacto: N1,P1,T25,H60,...
4. CRC-8 calculado sobre el mensaje completo
5. lora_driver transmite via LoRa 433 MHz
6. Gateway recibe el paquete LoRa
7. router_service valida CRC-8
8. parser_service convierte a JSON: {"sequence":1,"temperature":25,...}
9. Se agregan metadatos: rssi, snr, crc_ok
10. mqtt_service publica a: lora/gateway_01/N1/telemetry
11. display_service actualiza OLED con los valores recibidos
```

---

## Notas importantes

- **GPIO 15 es pin strapping** -- No usar para XSHUT del VL53L0X. Usar GPIO 13, 2, 4, 16 o 17.
- **Pull-ups I2C** -- Agregar resistencias de 4.7k en lineas SDA y SCL a 3.3V.
- **LoRa SPI diferente** -- El nodo usa VSPI (pines 18,19,23,5) y el gateway usa HSPI (pines 12,13,11,10). No comparten bus SPI.
- **Gateway IDs separados** -- `gateway_01` para hardware, `gateway_02` para simulador. Pueden coexistir en el mismo broker.
- **Frecuencia LoRa** -- Configurada a 433 MHz. Verificar regulaciones locales.
- **Intervalo de envio** -- Configurable via MQTT sin reflashear el nodo.
