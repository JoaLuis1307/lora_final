# ESP32 + SX1278 + MQTT -- Sistema de Monitoreo de Contenedores

Firmware del sistema de telemetria para contenedores de basura. Los nodos ESP32
leen sensores y envian un paquete compacto por **LoRa P2P** (punto a punto, sin
LoRaWAN) a un gateway. El gateway valida el paquete, lo convierte a JSON y lo
publica en el broker **MQTT**.

```
[Sensores] --> [Nodo ESP32] --LoRa P2P 433 MHz--> [Gateway ESP32] --MQTT/TCP--> [Broker Mosquitto]
                                                          |
                                                     [OLED SSD1306]
```

> **Alcance:** este proyecto usa exclusivamente LoRa P2P con la libreria
> `LoRa` de Sandeep Mistry. No se configura ni se requiere LoRaWAN.

---

## 1. Componentes

### Nodo (`firmware/node`)

| Sensor | Variable | Interfaz / GPIO |
|--------|----------|-----------------|
| INA219 | Voltaje, corriente, potencia y bateria restante | I2C (SDA 21, SCL 22, 0x40) |
| MQ135 | Calidad del aire (ADC raw) | GPIO 34 |
| HC-SR04 | Distancia por ultrasonido (cm) | TRIG 32 / ECHO 33 |
| HW-201 IR | Obstaculo (0/1) | GPIO 26 |
| VL53L0X | Distancia Time-of-Flight (cm) | I2C + XSHUT 13 |
| NEO-6M GPS | Latitud, longitud, altitud y satelites | Serial2 RX 16 / TX 17 |
| SX1278 | Radio LoRa 433 MHz | SPI |

> Los sensores de temperatura/humedad (DHT) estan **retirados**. La telemetria
> actual es calidad de aire, distancia de llenado, GPS y bateria.

LEDs del nodo: rojo 25 (tanque lleno), verde 2 (tanque disponible), azul 15
(estado LoRa).

### Gateway (`firmware/gateway`)

| Componente | Funcion | Interfaz |
|------------|---------|----------|
| SX1278 | LoRa 433 MHz RX/TX | SPI |
| SSD1306 | OLED 128x64 | I2C (SDA 18, SCL 17) |
| WiFi | Conexion a la red local | Interno |
| PubSubClient | Cliente MQTT | Software |

### Simulador (`firmware/simulator`)

Aplicacion Python con interfaz Tkinter que emula nodos y publica directamente a
MQTT (sin LoRa). Sirve para probar backend, web y reglas de negocio.

---

## 2. Pinout

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
| 21 | I2C SDA (VL53L0X + INA219) |
| 22 | I2C SCL (VL53L0X + INA219) |
| 25 | LED rojo (tanque lleno) |
| 2 | LED verde (tanque disponible) |
| 15 | LED azul (LoRa) |
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
| 4 | Boton (doble pulsacion = modo AP) |
| 2 | LED rojo (error de red) |
| 3 | LED azul 1 (estado) |
| 5 | LED azul 2 (actividad LoRa) |

---

## 3. Parametros de radio (SX1278)

Nodo y gateway **deben usar exactamente los mismos valores**:

| Parametro | Valor |
|-----------|-------|
| Banda | 433 MHz (modulo de 433 MHz, rango util 410-525 MHz) |
| Modulacion | LoRa P2P (CSS) |
| Spreading Factor | SF7 |
| Ancho de banda | 125 kHz |
| Coding Rate | 4/5 |
| Sync word | `0x12` (red privada) |
| Preambulo | 8 simbolos |
| CRC de radio | Habilitado (ademas del CRC-8 de aplicacion) |
| Potencia TX | 17 dBm (PA_BOOST sin PA_DAC; rango seguro 2-17 dBm) |
| Payload maximo | **255 bytes** (FIFO del SX1278 = 256; la libreria limita a 255) |

Notas de hardware:

- Alimentar el SX1278 con **3.3 V** y suficiente corriente. Los picos de TX a
  17 dBm pueden reiniciar el modulo si la fuente es debil.
- La antena debe estar conectada antes de transmitir.
- La frecuencia configurada en la web (nodo y gateway) se valida entre 410 y
  525 MHz y se aplica al arrancar. Si esta fuera de rango se usa 433 MHz.
- A 30 s de intervalo y SF7/BW125, cada paquete ocupa pocos cientos de ms de
  aire (~1 % de ciclo de trabajo, mas el ACK). Verificar la normativa local de
  la banda de 433 MHz antes de aumentar potencia o frecuencia de envio.

---

## 4. Protocolo LoRa P2P

### 4.1 Telemetria (nodo -> gateway)

El nodo envia un unico paquete de texto separado por comas:

```
{node_id},P{seq},TS{ms},SF{sf},BD{bw},CR{cr},TXP{dbm},
AQ{raw},U{cm},TOF{cm},IR{0|1},
LA{lat},LO{lon},B{alt},S{sats},
BAT{volt},BATP{pct},BI{mA},BW{mW},BR{mAh},BE{mAh},
BT{min},BEC{mWh},BET{mWh},BL{0|1},BK{0|1},CRC{crc8}
```

Ejemplo real (una linea, aqui dividida por legibilidad):

```
N1,P1,TS123456,SF7,BD125000,CR5,TXP17,AQ123,U45,TOF45,IR0,
LA-16.398800,LO-71.536800,B2335,S12,
BAT3.72,BATP85,BI120.5,BW448,BR1360,BE240.0,BT680,BEC892.8,BET5952,BL0,BK0,CRC207
```

| Campo | Significado | Ejemplo |
|-------|-------------|---------|
| `{node_id}` | ID del nodo (max. 15 caracteres, sin comas ni barras) | `N1` |
| `P` | Numero de secuencia | `P1` |
| `TS` | `millis()` del nodo al construir el paquete | `TS123456` |
| `SF` | Spreading Factor usado | `SF7` |
| `BD` | Ancho de banda en Hz | `BD125000` |
| `CR` | Coding Rate (4/5 = 5) | `CR5` |
| `TXP` | Potencia TX en dBm | `TXP17` |
| `AQ` | Calidad de aire (ADC raw MQ135) | `AQ123` |
| `U` | Distancia ultrasonido (cm) | `U45` |
| `TOF` | Distancia Time-of-Flight (cm); `-1` si no hay lectura | `TOF45` |
| `IR` | Obstaculo detectado (0/1) | `IR0` |
| `LA` / `LO` | Latitud / longitud GPS (6 decimales) | `LA-16.398800` |
| `B` | Altitud GPS (m) | `B2335` |
| `S` | Satelites GPS | `S12` |
| `BAT` | Voltaje de bateria (V) | `BAT3.72` |
| `BATP` | Estado de carga (%) | `BATP85` |
| `BI` / `BW` | Corriente (mA) / potencia (mW) | `BI120.5` |
| `BR` / `BE` | Capacidad restante / consumida (mAh) | `BR1360` |
| `BT` | Autonomia estimada (min) | `BT680` |
| `BEC` / `BET` | Energia consumida / total (mWh) | `BEC892.8` |
| `BL` / `BK` | Bateria baja / critica (0/1) | `BL0` |
| `CRC` | CRC-8 calculado sobre todo lo anterior | `CRC207` |

El campo `CRC` se calcula sobre el mensaje completo **antes** de agregar
`,CRC...` (es decir, incluyendo `{node_id},`). El gateway descarta por defecto
los paquetes con CRC invalido (`LORA_PUBLISH_CRC_ERRORS 0`). Para diagnostico se
puede poner en `1` y el gateway los publicara con `"crc_ok":0`.

El payload maximo del SX1278 es 255 bytes. El firmware del nodo y del gateway
rechaza cualquier envio que lo supere en lugar de transmitir un paquete
truncado (que romperia el CRC).

### 4.2 ACK del nodo (nodo -> gateway)

```
{node_id},ACK{tipo},{CRC}
```

Tipos: `0` ping, `1` intervalo cambiado, `2` reboot, `3` envio solicitado,
`9` comando desconocido. El gateway lo publica en
`lora/{gateway_id}/{node_id}/ack` como `{"ack":tipo}`.

### 4.3 Comandos (gateway -> nodo)

```
{node_id}|command|{json}
```

Ejemplo:

```
N1|command|{"cmd":"ping"}
```

| Comando | Descripcion | Respuesta |
|---------|-------------|-----------|
| `{"cmd":"ping"}` | Verifica conectividad | `ACK0` |
| `{"cmd":"reboot"}` | Reinicia el nodo | `ACK2` |
| `{"cmd":"request"}` | Envia telemetria inmediata | `ACK3` |
| `{"cmd":"interval","value":30000}` | Cambia el intervalo (5000-3600000 ms) | `ACK1` |
| Cualquier otro | Comando no reconocido | `ACK9` |

### 4.4 Comandos del gateway (MQTT -> gateway)

Topic: `lora/{gateway_id}/command`

| Comando | Descripcion |
|---------|-------------|
| `{"display":0}` | OLED: estado (0), telemetria (1), senal (2) |
| `{"info":1}` | Publica `info` del gateway |
| `{"stats":1}` | Publica `stats` |
| `{"status":1}` | Publica `status` |

### 4.5 CRC-8

Mismo algoritmo en nodo, gateway y simulador:

```
Polinomio: 0x07
Valor inicial: 0x00
Por cada byte: CRC ^= byte; 8 veces: si bit7=1 -> (CRC << 1) ^ 0x07,
               si no -> CRC << 1
```

---

## 5. MQTT

### 5.1 Topics

| Topic | Direccion | Descripcion |
|-------|-----------|-------------|
| `lora/{gateway_id}/status` | Gateway -> Broker | Estado online/offline (retained, LWT) |
| `lora/{gateway_id}/info` | Gateway -> Broker | Uptime, heap, RSSI WiFi, version |
| `lora/{gateway_id}/stats` | Gateway -> Broker | Paquetes, errores CRC, nodos |
| `lora/{gateway_id}/{node_id}/telemetry` | Gateway -> Broker | Telemetria JSON |
| `lora/{gateway_id}/{node_id}/ack` | Gateway -> Broker | ACK del nodo |
| `lora/{gateway_id}/command` | Broker -> Gateway | Comandos al gateway |
| `lora/{gateway_id}/{node_id}/command` | Broker -> Gateway | Comandos a un nodo |

El backend (`backend/src/plugins/mqtt.ts`) se suscribe a
`lora/+/+/telemetry`, por lo que el formato de topic debe respetarse
exactamente. `gateway_id` y `node_id` no pueden contener `/`, `+`, `#`,
espacios, `|` ni comas.

### 5.2 Ejemplo de telemetria publicada

```json
{
  "sequence": 1,
  "source_timestamp_ms": 123456,
  "spreading_factor": 7,
  "bandwidth_hz": 125000,
  "coding_rate": 5,
  "tx_power_dbm": 17,
  "air_quality": 123,
  "ultrasonic_cm": 45,
  "tof_cm": 45,
  "obstacle": 0,
  "latitude": -16.398800,
  "longitude": -71.536800,
  "altitude": 2335,
  "satellites": 12,
  "battery": 3.72,
  "battery_pct": 85,
  "batt_current_ma": 120.5,
  "batt_power_mw": 448,
  "batt_remaining_mah": 1360,
  "batt_consumed_mah": 240.0,
  "batt_runtime_min": 680,
  "batt_energy_consumed_mwh": 892.8,
  "batt_energy_total_mwh": 5952,
  "batt_low": 0,
  "batt_critical": 0,
  "timestamp": 1234,
  "rssi": -75,
  "snr": 8.5,
  "pkts": 150,
  "crc_ok": 1,
  "crc_err": 0
}
```

`timestamp` es el uptime del gateway en segundos; la hora real la asigna el
backend al recibir el mensaje.

### 5.3 Tamano del buffer MQTT

La telemetria JSON completa (GPS + todos los campos de bateria) ronda los
**600 bytes**. `PubSubClient` reserva ademas el topic y la cabecera MQTT, por lo
que un buffer de 512 bytes hace que `publish()` falle en silencio.

En `gateway/config.h`:

```c
#define MQTT_BUFFER_SIZE 1024
```

Si se agregan mas campos al JSON, aumentar este valor. El firmware ahora
reporta por serial cualquier `publish()` fallido, incluyendo topic, longitud y
estado del cliente MQTT.

### 5.4 Configuracion del broker

En `gateway/config.h` (o desde la web del gateway, que se guarda en NVS):

```c
#define MQTT_SERVER     "179.197.88.129"
#define MQTT_PORT       1883
#define MQTT_USER       "iotuser"
#define MQTT_PASS       "130798"
#define MQTT_GATEWAY_ID "gateway_01"
```

El servidor, puerto, usuario, clave y `gateway_id` configurados desde la web se
aplican al reiniciar. El gateway usa `MQTT_CLIENT_ID` como identificador de
sesion.

---

## 6. Instalacion y uso

### 6.1 Hardware

- 2x ESP32-S3 (o ESP32 clasico)
- 2x modulo LoRa SX1278/RFM95W de **433 MHz**
- 1x INA219, 1x MQ135, 1x HC-SR04, 1x HW-201 IR, 1x VL53L0X, 1x NEO-6M GPS
- 1x SSD1306 OLED 128x64
- Fuente 3.3 V/5 V adecuada; pull-ups I2C de 4.7k

### 6.2 Librerias (Arduino IDE)

**Nodo:**
- `LoRa` by Sandeep Mistry
- `VL53L0X` by Pololu
- `TinyGPSPlus` by Mikal Hart
- `Adafruit INA219` (segun el driver incluido)

**Gateway:**
- `LoRa` by Sandeep Mistry
- `PubSubClient` by Nick O'Leary
- `Adafruit SSD1306`
- `Adafruit GFX`

### 6.3 Compilar y subir

**Nodo:**

1. Abrir `firmware/node/node.ino` en Arduino IDE.
2. Seleccionar placa `ESP32S3 Dev Module` (o la ESP32 usada).
3. Verificar y subir.
4. Abrir monitor serial a 115200 baud.

**Gateway:**

1. Abrir `firmware/gateway/gateway.ino`.
2. Editar `firmware/gateway/config.h` con WiFi y broker, o configurar por la
   web del gateway.
3. Verificar y subir.
4. Abrir monitor serial a 115200 baud.

### 6.4 Simulador Python

```
cd firmware/simulator
pip install -r requirements.txt
python simulator.py
```

En Windows tambien se puede usar `run.bat`.

### 6.5 Test individual de sensores

```
firmware/tests/sensors/tof_vl53l1x/tof_test.ino   # VL53L0X standalone
```

---

## 7. Menu serial

### Nodo

```
[0] Normal   - Envio LoRa periodico
[1] Debug    - Leer todos los sensores
[2] Sensor   - Monitorear un sensor individual
```

Sensores seleccionables en modo Sensor: INA219, MQ135, HC-SR04, HW-201 IR,
VL53L0X, NEO-6M GPS.

### Gateway

```
[0] OLED estado   [1] OLED telemetria   [2] OLED senal
[s] Estadisticas  [t] Guia MQTT Explorer  [i] Info del sistema
```

---

## 8. Estructura del proyecto

```
firmware/
  gateway/
    gateway.ino                    # Entry point gateway
    config.h                       # WiFi, MQTT, pines y limites LoRa
    src/
      app/gateway_app.cpp          # Logica principal
      drivers/
        wifi_driver.cpp            # Conexion WiFi
        lora_driver.cpp            # LoRa SX1278
        led_driver.cpp             # LEDs
      services/
        mqtt_service.cpp           # Cliente MQTT y publicacion
        router_service.cpp         # LoRa -> MQTT, CRC y comandos
        parser_service.cpp         # Protocolo compacto <-> JSON
        web_service.cpp            # Configuracion web + NVS
        node_store.cpp             # Nodos descubiertos / whitelist
        display_service.cpp        # Pantalla OLED
  node/
    node.ino                       # Entry point nodo
    config.h                       # Pines, tiempos e ID por defecto (N1)
    src/
      app/node_app.cpp             # Logica principal + menu serial
      drivers/
        lora_driver.cpp            # LoRa SX1278
        mq135_driver.cpp           # Calidad de aire
        ultrasonic_driver.cpp      # HC-SR04
        ir_driver.cpp              # HW-201 IR
        tof_driver.cpp             # VL53L0X
        gps_driver.cpp             # NEO-6M GPS
        ina219_driver.cpp          # Bateria
      services/
        sensor_service.cpp         # Inicializacion y lectura de sensores
        report_service.cpp         # Payload compacto + CRC
        command_service.cpp        # Comandos/ACK por LoRa
        node_config_service.cpp    # Web AP + NVS
  simulator/                       # Emulador Python
  tests/sensors/                   # Tests standalone
  README.md
```

---

## 9. Flujo de datos completo

```
1. El nodo lee INA219, MQ135, HC-SR04, HW-201, VL53L0X y GPS.
2. report_service construye el payload compacto (P, TS, SF, AQ, U, TOF, GPS...).
3. Se calcula CRC-8 sobre el mensaje y se agrega ,CRC.
4. lora_send_with_retries transmite por LoRa P2P 433 MHz (max. 255 bytes).
5. El gateway recibe, lee RSSI/SNR y valida el CRC.
6. Si el CRC es valido, parser_service convierte a JSON y agrega metadatos.
7. mqtt_service publica en lora/{gateway_id}/{node_id}/telemetry.
8. El gateway responde al nodo por LoRa con un ACK.
9. El backend Fastify recibe el mensaje, calcula el llenado y guarda historial.
10. La web/mobile recibe la actualizacion por WebSocket.
```

---

## 10. Solucion de problemas

| Sintoma | Causa probable | Solucion |
|---------|----------------|----------|
| El gateway recibe pero no hay datos en MQTT | Buffer MQTT de 512 bytes | Usar `MQTT_BUFFER_SIZE 1024` y revisar el serial para `MQTT publish FALLO` |
| `rc=-2` al conectar MQTT | Broker inaccesible o credenciales | Verificar IP/puerto/usuario/clave; el broker debe permitir el cliente |
| No llega nada al gateway | Nodo y gateway con frecuencia/sync distintos | Igualar 433 MHz, SF7, BW125, CR4/5 y sync `0x12` |
| Paquetes descartados con `CRC ERROR` | Ruido, payload truncado o CRC mal calculado | Revisar alimentacion/antena; el gateway descarta CRC invalido por defecto |
| RSSI/SNR en 0 | Se leyo antes de consumir el payload | Leer `packetRssi()`/`packetSnr()` despues de `read()` (ya implementado) |
| El nodo no recibe comandos | Radio quedo en standby/idle | El driver vuelve a `LoRa.receive()` tras TX y tras medir ruido |
| Payload mayor a 255 bytes | Demasiados campos/Campos muy largos | Reducir precision o campos; el firmware rechaza el envio |
| Dos dispositivos con el mismo `gateway_id` | Topics y LWT en conflicto | Usar IDs unicos |

---

## 11. Notas importantes

- **GPIO 15 es pin strapping**: no usar para XSHUT del VL53L0X. Se usa GPIO 13.
- **Pull-ups I2C**: 4.7k entre SDA/SCL y 3.3 V.
- **Buses SPI separados**: el nodo usa VSPI (18/19/23/5) y el gateway HSPI
  (12/13/11/10). No comparten bus.
- **IDs unicos**: `gateway_01` para hardware y `gateway_02` para el simulador
  pueden coexistir en el mismo broker.
- **Frecuencia**: 433 MHz por defecto. Verificar la normativa local.
- **Intervalo de envio**: configurable por web, comando MQTT o
  `SEND_INTERVAL` (5000-3600000 ms).
- **Sin cifrado**: LoRa P2P aqui no cifra el contenido; el CRC-8 solo detecta
  errores. No enviar datos sensibles por este enlace.
