# ============================================================
# CONFIGURACION DEL BROKER MQTT (DINÁMICA)
# ============================================================
# Se autoconfigura a partir del .env del backend o variables de entorno,
# facilitando el cambio de IP/DNS en un solo lugar al desplegar.

import os
import re

# Valores por defecto en local
MQTT_BROKER = "145.79.1.173"
MQTT_PORT = 1883
MQTT_USER = None
MQTT_PASS = None

# Intentar cargar la configuración desde el archivo .env del backend
# para sincronizar automáticamente el broker MQTT
backend_env_path = os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env")
if os.path.exists(backend_env_path):
    try:
        with open(backend_env_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Buscar MQTT_BROKER en el .env
            match_broker = re.search(r"^MQTT_BROKER\s*=\s*(.+)$", content, re.MULTILINE)
            if match_broker:
                broker_val = match_broker.group(1).strip().strip('"').strip("'")
                # Si el valor empieza por mqtt:// o mqtts://, extraer solo el host/IP
                if broker_val.startswith("mqtt://"):
                    MQTT_BROKER = broker_val.replace("mqtt://", "")
                elif broker_val.startswith("mqtts://"):
                    MQTT_BROKER = broker_val.replace("mqtts://", "")
                else:
                    MQTT_BROKER = broker_val
            
            # Buscar MQTT_PORT
            match_port = re.search(r"^MQTT_PORT\s*=\s*(.+)$", content, re.MULTILINE)
            if match_port:
                MQTT_PORT = int(match_port.group(1).strip().strip('"').strip("'"))

            # Buscar MQTT_USER
            match_user = re.search(r"^MQTT_USER\s*=\s*(.+)$", content, re.MULTILINE)
            if match_user:
                user_val = match_user.group(1).strip().strip('"').strip("'")
                if user_val:
                    MQTT_USER = user_val

            # Buscar MQTT_PASS
            match_pass = re.search(r"^MQTT_PASS\s*=\s*(.+)$", content, re.MULTILINE)
            if match_pass:
                pass_val = match_pass.group(1).strip().strip('"').strip("'")
                if pass_val:
                    MQTT_PASS = pass_val
    except Exception as e:
        print(f"[CONFIG] Aviso: No se pudo auto-cargar backend/.env: {e}")

# Permitir sobrescribir opcionalmente con variables de entorno del sistema
if "MQTT_BROKER" in os.environ:
    MQTT_BROKER = os.environ["MQTT_BROKER"]
if "MQTT_PORT" in os.environ:
    try:
        MQTT_PORT = int(os.environ["MQTT_PORT"])
    except ValueError:
        pass
if "MQTT_USER" in os.environ:
    MQTT_USER = os.environ["MQTT_USER"]
if "MQTT_PASS" in os.environ:
    MQTT_PASS = os.environ["MQTT_PASS"]

MQTT_GATEWAY_ID = "gateway_02"
MQTT_CLIENT_ID = "SimuladorNodos"

# Intervalo de envio por defecto (ms)
DEFAULT_INTERVAL_MS = 5000

# Coordenadas por defecto (Arequipa, Peru)
DEFAULT_LAT = -16.3988
DEFAULT_LON = -71.5368
DEFAULT_ALT = 2335

