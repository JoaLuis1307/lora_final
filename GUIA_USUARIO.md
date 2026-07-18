# Guía de Funcionamiento y Despliegue: EcoSmart IoT

Esta guía describe en detalle cómo funciona el sistema de monitoreo inteligente de contenedores de basura basado en **LoRa P2P**, paso a paso, y cómo desplegar toda la infraestructura en un servidor en la nube (VPS).

---

## 1. ¿Cómo Funciona el Sistema? (Flujo de Datos Paso a Paso)

El sistema está diseñado para monitorear el estado de llenado de contenedores de basura en tiempo real sin depender de redes de telefonía celular costosas, utilizando comunicación de largo alcance y bajo consumo (LoRa P2P).

```
[ Contenedor Físico ]
       │
       ▼ (Sensor mide distancia de basura mediante ultrasonido/TOF)
[ Nodo Transmisor LoRa P2P ]
       │
       ▼ (Envío inalámbrico de paquetes de datos a 915 MHz)
[ Gateway Concentrador (Receptor) ]
       │
       ▼ (Se conecta a Internet WiFi y traduce los datos a formato JSON)
[ Servidor Cloud (VPS 145.79.1.173) ]
  ├── Mosquitto Broker (Recibe el paquete MQTT)
  ├── Backend Fastify (Procesa la telemetría, valida el hardware y calcula llenado)
  ├── Base de Datos (Guarda configuraciones e InfluxDB registra el historial)
  └── Web React (Muestra la información al usuario en tiempo real mediante WebSockets)
```

### El flujo detallado:
1. **Medición**: El sensor instalado en la tapa del contenedor mide la distancia hacia la basura en centímetros.
2. **Envío de Radio**: El microcontrolador del **Nodo** transmite este dato mediante un paquete cifrado por radiofrecuencia (LoRa P2P) a la frecuencia de 915 MHz.
3. **Recepción en Base**: El **Gateway** (ubicado en un punto estratégico con internet) recibe el paquete por radio, lo decodifica y lo publica como un mensaje MQTT en el broker del servidor en la nube.
4. **Procesamiento en Servidor**: El servidor en la nube recibe el mensaje. Si el nodo está registrado, calcula el porcentaje de llenado (ej: si mide 10cm está al 90%, si mide 80cm está vacío) y actualiza la base de datos de inmediato.
5. **Visualización en Vivo**: El panel web del operador recibe el dato automáticamente a través de WebSockets (sin necesidad de recargar la página) y actualiza los mapas, alarmas y estadísticas al instante.

---

## 2. Componentes del Sistema

El proyecto está modularizado utilizando **Docker** y corre en segundo plano en el servidor:

* **Frontend (Aplicación Web)**: Interfaz hecha en React.js, estilizada con Material UI v6 bajo las guías de diseño de Google (esquinas redondeadas, colores sutiles y sin bordes rígidos).
* **Backend (Servidor API)**: Hecho en Fastify (Node.js + TypeScript). Escucha los eventos de red, administra usuarios, dispositivos, mapas y almacena la telemetría histórica.
* **Base de Datos Relacional (SQLite / PostgreSQL)**: Almacena los metadatos de los dispositivos, los usuarios registrados y los puntos del mapa.
* **InfluxDB (Base de datos de series de tiempo)**: Almacena cada transmisión recibida de los sensores para graficar el historial de llenado y el rendimiento de la batería en las estadísticas.
* **Mosquitto Broker**: Servidor de mensajería MQTT que gestiona el canal por donde el Gateway transmite los datos al backend.

---

## 3. Guía de Despliegue Paso a Paso en Servidor VPS

El despliegue está completamente automatizado a través de **Docker Compose**. Los pasos para levantar el servidor desde cero o actualizarlo son:

### Paso 1: Conexión al Servidor VPS
Abre una terminal de SSH en tu computadora y conéctate al servidor VPS con tus credenciales:
```bash
ssh root@145.79.1.173
```

### Paso 2: Clonar o Actualizar el Código
Navega al directorio donde se encuentra alojado el proyecto:
```bash
cd /ruta/del/proyecto/lora_final
```
Para traer los últimos cambios visuales y funcionales del repositorio GitHub:
```bash
git pull
```

### Paso 3: Configurar las Variables de Entorno
Verifica que el archivo `.env` en la raíz del proyecto contenga las IPs y puertos correctos:
```bash
# Variables ejemplo en el archivo .env
BACKEND_PORT=5000
MQTT_HOST=localhost
MQTT_PORT=1883
INFLUX_URL=http://localhost:8086
```

### Paso 4: Levantar la Infraestructura con Docker
Ejecuta el siguiente comando para compilar las imágenes e iniciar todos los servicios del sistema en segundo plano (Nginx, React, Node.js, Mosquitto, Postgres, InfluxDB):
```bash
docker compose up -d --build
```
* **Nginx** se encargará de servir la aplicación React en el puerto `80` (HTTP) y redireccionar las peticiones API al backend en segundo plano.

---

## 4. Manual del Operador (Uso de la Aplicación)

Cuando ingreses a la dirección IP de tu servidor (`http://145.79.1.173`) en tu navegador:

### 1. Panel de Control (Consola Principal)
* Te dará un resumen general de la operación: cantidad total de contenedores, promedio de señal de red (RSSI) de los sensores reales, y número de alertas activas.
* Cuenta con un mapa de calor rápido y tarjetas de estado general.

### 2. Sección de Contenedores
* Muestra la lista de los contenedores inteligentes con su modelo 3D característico.
* Puedes alternar entre **Vista de Cuadrícula** (diseño visual con fotos) y **Vista de Tabla** (ideal para cuando administres más de 20 contenedores de forma rápida).
* Permite activar el **Modo edición** para registrar, modificar coordenadas o eliminar contenedores físicamente.

### 3. Sección de Rutas (Logística)
* El mapa te permite planificar las rutas del camión recolector. Dispone de dos modos:
  * **Modo Manual**: Activa el botón `+` (modo dibujo) y haz clics en el mapa. El sistema trazará de forma inteligente la ruta óptima por las calles de Arequipa (usando el motor OSRM), calculando la distancia en kilómetros y el tiempo estimado del recorrido.
  * **Modo IA EcoRoute (Optimización Automática)**:
    * Selecciona el **Tipo de Camión** (Compactador Pesado de 12 km/gal o Urbano Ligero de 18 km/gal).
    * Haz clic en **"Calcular Ruta Inteligente IA"**. El sistema recopilará en tiempo real los contenedores casi desbordados (capacidad ≥ 70%) y resolverá el **Problema del Viajante (TSP)** mediante un algoritmo de vecindad más cercana partiendo desde el Depósito Municipal de Yanahuara.
    * Trazará automáticamente la ruta óptima en el mapa y deducirá el **consumo de combustible en galones**, el **combustible ahorrado** y la **reducción en emisiones de CO₂** (en base a la métrica diésel estándar de la EPA).
    * Enlistará la secuencia ordenada de paradas con chips coloreados según el nivel de llenado actual.
    * Podrás asignarle un nombre y guardar la ruta directamente en la base de datos.
  * **Capas del Mapa**: En el icono de capas, puedes cambiar el estilo del mapa. La capa **Terreno** cargará directamente el mapa topográfico oficial de Google Maps (`lyrs=p`) con relieves de montañas y valles.

### 4. Sección de Mapa 3D
* Permite visualizar la ciudad de Arequipa con inclinación 3D.
* **Panel de Red (Derecha)**: Al abrirlo, se listan todos los contenedores con sus niveles de batería reales de los sensores (sin bugs de 0%) y su indicador de nivel de señal LoRa P2P. Cuenta con barras de progreso de capacidad integradas y tiene un fondo translúcido que se acopla de manera elegante con el tema del sitio.
