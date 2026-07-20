# Guía de Empaquetado y Despliegue con Docker Compose (Nivel 0)

Esta guía describe detalladamente cómo empaquetar, configurar y desplegar el sistema IoT para contenedores municipales (tecnología LoRa P2P) utilizando **Docker Compose** en cualquier máquina o servidor Linux (VPS) desde cero.

---

## 📋 Arquitectura de Contenedores

El despliegue está orquestado en **5 servicios independientes** que se comunican a través de una red privada virtual de Docker:

1. **`ecolora-db` (PostgreSQL 16)**: Almacén de datos relacionales (usuarios, configuraciones, información de contenedores).
2. **`ecolora-mqtt` (Eclipse Mosquitto)**: Broker MQTT que recibe la telemetría enviada por los Gateways LoRa P2P.
3. **`ecolora-influxdb` (InfluxDB 2)**: Base de datos de series temporales para el histórico de telemetría de alta velocidad.
4. **`ecolora-backend` (Fastify + Prisma)**: Servidor API escrito en Node/TypeScript. Se conecta a PostgreSQL, InfluxDB, recibe los eventos de Mosquitto y sirve datos al frontend.
5. **`ecolora-frontend` (React + Nginx)**: Aplicación web de control y visualización de mapas y estadísticas. Servida mediante Nginx y expuesta al puerto `80`.

---

## 🛠️ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente en tu máquina o VPS:

* **Docker** (versión 20.10 o superior)
* **Docker Compose** (versión v2.0 o superior)
* **Git** (para clonar y actualizar el repositorio)

En servidores Ubuntu/Debian, puedes instalarlos rápidamente ejecutando:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
```

---

## 🚀 Guía de Despliegue Paso a Paso

### Paso 1: Obtener el Código Fuente
Clona el repositorio en tu servidor y accede al directorio del proyecto:
```bash
git clone https://github.com/JoaLuis1307/lora_final.git
cd lora_final
```

### Paso 2: Configurar las Variables de Entorno (`.env`)
El archivo principal de Docker Compose toma las credenciales y configuraciones del entorno. Asegúrate de configurar los archivos `.env` en cada sección:

#### 1. Backend (`./backend/.env`)
Crea o edita el archivo `./backend/.env` para definir la conexión local a la base de datos (apuntando al contenedor `db` interno) y las claves de InfluxDB:
```env
PORT=3001
HOST=0.0.0.0
JWT_SECRET=supersecret_jwt_key_smart_containers_2026

# Conexión al contenedor PostgreSQL de docker
DATABASE_URL="postgresql://admin:admin123@db:5432/iot_db?schema=public"

# Enlace al Broker MQTT interno
MQTT_BROKER="mqtt://mqtt"
MQTT_PORT=1883

# Enlace al contenedor InfluxDB interno
INFLUX_URL="http://influxdb:8086"
INFLUX_TOKEN="jLsONHjrqqtbPKF4snQs-l4oGS-Eo7y7Biq8O6HtUxbqJMsOGTWANg5rp6gW7feI2saXoDeJzsD2dzq7nYl_kQ=="
INFLUX_ORG="iot_org"
INFLUX_BUCKET="iot_bucket"
```

#### 2. Frontend (`./web_app/.env.production`)
Este archivo ya viene pre-configurado en el repositorio para producción. Si usas Supabase externo para login, aquí configuras las claves. Nginx redirigirá las peticiones `/api/v1` y `/ws` hacia el contenedor del backend automáticamente:
```env
REACT_APP_SUPABASE_URL=https://rxcyrjrflhqfkajubuvr.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_zjsmqwrxo4iwnXVqeU9Kgw_PqinAiwt
REACT_APP_API_URL=/api/v1
REACT_APP_WS_URL=/ws
```

---

### Paso 3: Empaquetar y Construir (Build)
Docker Compose leerá los Dockerfiles del Frontend y del Backend para compilar las aplicaciones utilizando imágenes multi-etapa (multi-stage builds) para optimizar el tamaño.

Para construir todas las imágenes por primera vez, ejecuta:
```bash
docker compose build
```
> 💡 *Este proceso descarga las dependencias de Node.js, compila el código TypeScript del backend, genera el cliente de Prisma y empaqueta el frontend React dentro de una imagen ligera de Nginx.*

---

### Paso 4: Levantar los Servicios (Despliegue)
Una vez construidas las imágenes, inicia todos los contenedores en segundo plano (modo daemon):
```bash
docker compose up -d
```

Este comando:
1. Crea los volúmenes persistentes para PostgreSQL, InfluxDB y Mosquitto (evita pérdida de datos al apagar contenedores).
2. Levanta las bases de datos y el broker MQTT.
3. Levanta el backend (Fastify) y espera a que la DB esté lista.
4. Levanta el frontend (Nginx) en el puerto `80`.

---

### Paso 5: Inicializar la Base de Datos (Prisma DB Push)
Con los contenedores corriendo, la base de datos de PostgreSQL estará vacía. Debes inyectar el esquema de base de datos de Prisma ejecutando el siguiente comando dentro del contenedor del backend:
```bash
docker compose exec backend npx prisma db push
```
> 💡 *Este comando crea automáticamente todas las tablas necesarias (dispositivos, puntos de mapa, registros de telemetría, etc.) y aplica los índices requeridos sin necesidad de configuraciones manuales en PostgreSQL.*

---

### Paso 6: Verificar que todo Funciona
Para comprobar el estado de los contenedores:
```bash
docker compose ps
```
Deberías ver los 5 contenedores en estado `Up` (corriendo).

Para ver los logs en tiempo real y diagnosticar posibles errores:
```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs únicamente del backend Fastify
docker compose logs -f backend
```

---

## 🌍 Puertos Expuestos al Público
* **Puerto `80` (HTTP)**: Acceso a la interfaz web del Frontend.
* **Puerto `1883` (MQTT)**: Puerto donde los Gateways LoRa P2P deben reportar la telemetría mediante MQTT.
* **Puerto `3001` (API HTTP)**: Puerto público del backend (opcional/desarrollo).
* **Puerto `8086` (InfluxDB)**: Consola de administración de InfluxDB (opcional).

---

## 🔄 Actualización y Mantenimiento de Cambios
Cuando subas nuevos cambios a la rama principal de GitHub y quieras aplicarlos en el servidor, solo debes seguir esta secuencia:

```bash
# 1. Traer el último código del repositorio
git pull origin main

# 2. Re-construir y levantar los contenedores con los nuevos cambios sin detener los datos
docker compose up -d --build

# 3. (Opcional) Si hubo cambios en el esquema de la base de datos
docker compose exec backend npx prisma db push
```

---

## 🧹 Comandos de Limpieza (Reset)
Si deseas apagar los contenedores y liberar memoria:
```bash
docker compose down
```

Si deseas apagar los contenedores y **borrar todos los datos almacenados** en las bases de datos para iniciar una instalación totalmente limpia desde cero:
```bash
docker compose down -v
```
