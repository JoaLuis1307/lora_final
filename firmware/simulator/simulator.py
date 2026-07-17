#!/usr/bin/env python3
"""
SIMULADOR DE NODOS ESP32 - Contenedores de basura
===================================================
Simula N nodos con sensores y publica en MQTT
con el mismo formato compacto del firmware real.

Uso:
  1. Editar config.py con los datos de tu broker
  2. pip install -r requirements.txt
  3. python simulator.py
"""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import json
import random
import math
from datetime import datetime
import config as cfg
from config import *

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False


# ============================================================
# CRC-8 (mismo algoritmo que el firmware ESP32)
# ============================================================
def crc8(data: bytes) -> int:
    crc = 0x00
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0x07) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


# Constantes del contenedor (mismas que el firmware real)
EMPTY_DISTANCE_CM = 120.0
FULL_DISTANCE_CM = 10.0
TANK_CAPACITY_L = 1100.0

SENSOR_ATTR_MAP = {
    "temp": "temperatura",
    "hum": "humedad",
    "aq": "air_quality",
    "fill": "fill_level",
    "tof": "tof_mm",
    "lat": "gps_lat",
    "lon": "gps_lon",
    "alt": "gps_alt",
    "sats": "gps_sats",
    "bateria": "bateria",
    "rssi": "rssi",
    "snr": "snr",
}

# ============================================================
# NODO SIMULADO
# ============================================================
class NodoSimulado:
    def __init__(self, node_num: int, nombre: str = "", lat=None, lon=None, fill_rate=10):
        self.node_num = node_num
        self.node_id = f"N{node_num}"
        self.nombre = nombre or f"Contenedor {node_num}"
        self.activo = True
        self.seq = 0
        self.ultimo_envio = ""
        self.fill_rate = fill_rate

        self.temperatura = 20.0
        self.humedad = 50.0
        self.air_quality = 300
        self.fill_level = random.uniform(5, 40)
        self.tof_mm = 120 - (self.fill_level / 200.0) * 119
        self.ir_obstaculo = False

        self.gps_lat = lat or DEFAULT_LAT + random.uniform(-0.05, 0.05)
        self.gps_lon = lon or DEFAULT_LON + random.uniform(-0.05, 0.05)
        self.gps_alt = DEFAULT_ALT + random.randint(-50, 50)
        self.gps_sats = random.randint(8, 14)
        self.gps_valido = True
        self.bateria = random.randint(70, 100)
        self.rssi = random.randint(-85, -45)
        self.snr = round(random.uniform(5.0, 12.0), 1)
        self.manual_override = False

    def generar_payload(self) -> str:
        self.seq += 1
        temp_int = int(round(self.temperatura))
        hum_int = int(round(self.humedad))
        aq = int(self.air_quality)
        fill = int(round(self.fill_level))
        tof = int(self.tof_mm)
        ir = 1 if self.ir_obstaculo else 0
        alt = int(round(self.gps_alt))
        sats = int(self.gps_sats)
        bat_int = int(round(self.bateria))
        rssi_int = int(round(self.rssi))
        snr_val = float(round(self.snr, 1))

        payload = f"P{self.seq}"
        payload += f",T{temp_int}"
        payload += f",H{hum_int}"
        payload += f",AQ{aq}"
        payload += f",U{fill}"
        payload += f",TOF{tof}"
        payload += f",IR{ir}"
        payload += f",B{alt}"
        payload += f",S{sats}"
        payload += f",BAT{bat_int}"
        payload += f",RSSI{rssi_int}"
        payload += f",SNR{snr_val}"
        payload += f",LA{self.gps_lat:.4f}"
        payload += f",LO{self.gps_lon:.4f}"

        msg = f"{self.node_id},{payload}"
        crc_val = crc8(msg.encode())
        msg += f",CRC{crc_val}"
        self.ultimo_envio = msg
        return msg

    def get_mqtt_topic(self, tipo="telemetry") -> str:
        return f"lora/{MQTT_GATEWAY_ID}/{self.node_id}/{tipo}"


# ============================================================
# PRESETS DE UBICACION (Arequipa)
# ============================================================
PRESETS_UBICACION = {
    "Yanahuara":         {"lat": -16.3888, "lon": -71.5415},
    "Av. Ejercito":      {"lat": -16.3920, "lon": -71.5460},
    "Centro Historico":  {"lat": -16.3988, "lon": -71.5368},
    "Cayma":             {"lat": -16.3733, "lon": -71.5434},
    "Selva Alegre":      {"lat": -16.3901, "lon": -71.5211},
    "Cerro Colorado":    {"lat": -16.3500, "lon": -71.5600},
    "Paucarpata":        {"lat": -16.4117, "lon": -71.5067},
    "Jose Bustamante":   {"lat": -16.4083, "lon": -71.5250},
    "Miraflores":        {"lat": -16.3944, "lon": -71.5236},
    "Mariano Melgar":    {"lat": -16.4167, "lon": -71.4833},
    "Sabandia":          {"lat": -16.4500, "lon": -71.4833},
}

TASAS_LLENADO = {
    "Yanahuara":         8,
    "Av. Ejercito":      18,
    "Centro Historico": 18,
    "Cayma":             7,
    "Selva Alegre":      6,
    "Cerro Colorado":    5,
    "Paucarpata":        6,
    "Jose Bustamante":  10,
    "Miraflores":        8,
    "Mariano Melgar":    5,
    "Sabandia":          3,
}


# ============================================================
# APLICACION PRINCIPAL
# ============================================================
class SimuladorApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Simulador de Nodos ESP32 - Contenedores Arequipa")
        self.root.geometry("1150x780")
        self.root.minsize(950, 650)

        self.nodos: list[NodoSimulado] = []
        self.nodo_seleccionado: NodoSimulado = None
        self.corriendo = False
        self.thread_envio = None
        self.packets_enviados = 0
        self.crc_ok_count = 0
        self.mqtt_client = None
        self.mqtt_conectado = False
        self._start_time = time.time()

        # Parámetros del firmware del gateway simulado (modificables en tiempo real)
        self.gw_ip = "192.168.100.47"
        self.gw_wifi_rssi = -47
        self.gw_heap = 200696
        self.gw_firmware = "1.0"
        self.gw_randomize = True

        self._init_ui()
        self._crear_nodo_inicial()
        self._actualizar_lista_nodos()
        self._actualizar_stats()
        self.root.after(1000, lambda: self._publicar_gateway_firmware(programar_siguiente=True))

    # ---- MQTT ----
    def _mqtt_connect(self):
        if not MQTT_AVAILABLE:
            self._log("paho-mqtt no instalado. pip install paho-mqtt")
            return False
        if self.mqtt_client:
            self.mqtt_client.disconnect()
        self.mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID)
        
        # Configurar Last Will and Testament (LWT) para el gateway simulado (gateway_02)
        topic_status = f"lora/{MQTT_GATEWAY_ID}/status"
        self.mqtt_client.will_set(topic_status, payload=json.dumps({"status": "offline"}), qos=1, retain=True)

        if MQTT_USER:
            self.mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
        self.mqtt_client.on_message = self._on_mqtt_message
        try:
            self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.mqtt_client.loop_start()
            self.mqtt_conectado = True
            self._actualizar_estado_conexion()
            self._log(f"Conectado a {MQTT_BROKER}:{MQTT_PORT}")
            return True
        except Exception as e:
            self.mqtt_conectado = False
            self._actualizar_estado_conexion()
            self._log(f"Error conexion MQTT: {e}")
            return False

    def _on_mqtt_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.mqtt_conectado = True
            client.subscribe(f"lora/{MQTT_GATEWAY_ID}/command")
            client.subscribe(f"lora/{MQTT_GATEWAY_ID}/+/command")
            self._actualizar_estado_conexion()
            self._log("MQTT conectado - escuchando comandos")
            # Publicar estado de gateway inmediatamente al conectar
            self.root.after(0, lambda: self._publicar_gateway_firmware(programar_siguiente=False))
        else:
            self.mqtt_conectado = False
            self._actualizar_estado_conexion()
            self._log(f"MQTT fallo codigo {reason_code}")

    def _on_mqtt_disconnect(self, client, userdata, reason_code, properties):
        self.mqtt_conectado = False
        self._actualizar_estado_conexion()

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
        except Exception:
            return
        topic = msg.topic
        self.root.after(0, lambda: self._procesar_comando(topic, data))

    def _procesar_comando(self, topic: str, data: dict):
        parts = topic.split("/")
        if len(parts) == 4 and parts[3] == "command":
            node_id = parts[2]
            self._aplicar_comando_nodo(node_id, data)
        elif len(parts) == 3 and parts[2] == "command":
            self._aplicar_comando_global(data)
        self._actualizar_lista_nodos()
        self._log(f"COMANDO: {topic} -> {data}")

    def _aplicar_comando_nodo(self, node_id: str, data: dict):
        nodo = next((n for n in self.nodos if n.node_id == node_id), None)
        if not nodo:
            self._log(f"Nodo {node_id} no encontrado")
            return
        if any(k in data for k in ("temp","hum","aq","fill","tof","ir","alt","sats","lat","lon","bateria","rssi","snr")):
            nodo.manual_override = True
        if "temp" in data:
            nodo.temperatura = float(data["temp"])
        if "hum" in data:
            nodo.humedad = float(data["hum"])
        if "aq" in data:
            nodo.air_quality = int(data["aq"])
        if "fill" in data:
            nodo.fill_level = float(data["fill"])
        if "tof" in data:
            nodo.tof_mm = float(data["tof"])
        if "ir" in data:
            nodo.ir_obstaculo = bool(data["ir"])
        if "alt" in data:
            nodo.gps_alt = float(data["alt"])
        if "sats" in data:
            nodo.gps_sats = int(data["sats"])
        if "lat" in data:
            nodo.gps_lat = float(data["lat"])
        if "lon" in data:
            nodo.gps_lon = float(data["lon"])
        if "bateria" in data:
            nodo.bateria = float(data["bateria"])
        if "rssi" in data:
            nodo.rssi = float(data["rssi"])
        if "snr" in data:
            nodo.snr = float(data["snr"])
        if "activo" in data:
            nodo.activo = bool(data["activo"])
        if data.get("cmd") == "recoleccion":
            nodo.fill_level = random.uniform(2, 12)
            nodo.ir_obstaculo = False
            nodo.seq = 0
        if self.nodo_seleccionado and self.nodo_seleccionado.node_id == node_id:
            self._cargar_nodo_en_panel(nodo)

    def _aplicar_comando_global(self, data: dict):
        if "interval" in data:
            val = max(200, int(data["interval"]))
            self.var_intervalo.set(str(val))
        if "variacion" in data:
            self.var_variacion.set(bool(data["variacion"]))
        if data.get("cmd") == "activar":
            target = data.get("node", "all")
            for n in self.nodos:
                if target == "all" or n.node_id == target:
                    n.activo = True
        if data.get("cmd") == "desactivar":
            target = data.get("node", "all")
            for n in self.nodos:
                if target == "all" or n.node_id == target:
                    n.activo = False

    def _mqtt_publish(self, topic, payload):
        if self.mqtt_client and self.mqtt_conectado:
            info = self.mqtt_client.publish(topic, payload, qos=0)
            return info.rc == 0
        return False

    def _publicar_gateway_firmware(self, programar_siguiente=True):
        if self.mqtt_conectado and self.mqtt_client:
            try:
                # 1. STATUS
                topic_status = f"lora/{MQTT_GATEWAY_ID}/status"
                payload_status = json.dumps({
                    "status": "online",
                    "ip": self.gw_ip
                })
                self._mqtt_publish(topic_status, payload_status)
                
                # 2. INFO
                uptime = int(time.time() - self._start_time)
                topic_info = f"lora/{MQTT_GATEWAY_ID}/info"
                
                heap_val = self.gw_heap
                rssi_val = self.gw_wifi_rssi
                if self.gw_randomize:
                    heap_val += random.randint(-2000, 2000)
                    rssi_val += random.randint(-4, 4)
                    
                payload_info = json.dumps({
                    "uptime": uptime,
                    "heap": heap_val,
                    "wifi_rssi": rssi_val,
                    "firmware": self.gw_firmware
                })
                self._mqtt_publish(topic_info, payload_info)
                
                # 3. STATS
                topic_stats = f"lora/{MQTT_GATEWAY_ID}/stats"
                nodos_activos = sum(1 for n in self.nodos if n.activo)
                payload_stats = json.dumps({
                    "packets": self.packets_enviados,
                    "crc_errors": 0,
                    "nodes": nodos_activos
                })
                self._mqtt_publish(topic_stats, payload_stats)
                
                self._log(f"GATEWAY [{MQTT_GATEWAY_ID}] -> Estado, Info y Stats de firmware publicados en MQTT")
            except Exception as e:
                self._log(f"Error publicando firmware de gateway: {e}")
        
        if programar_siguiente:
            # Re-programar cada 30 segundos (STATUS_INTERVAL)
            self.root.after(30000, lambda: self._publicar_gateway_firmware(programar_siguiente=True))

    # ---- UI ----
    def _init_ui(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview", rowheight=26)
        style.configure("Active.Treeview", background="#e8f5e9")
        style.configure("Inactive.Treeview", background="#f5f5f5")

        # Barra superior - Conexion
        frame_top = ttk.Frame(self.root, padding=5)
        frame_top.pack(fill=tk.X)

        self.lbl_conexion = ttk.Label(frame_top, text="● Desconectado", foreground="red", font=("Segoe UI", 9, "bold"))
        self.lbl_conexion.pack(side=tk.LEFT, padx=5)

        ttk.Button(frame_top, text="Conectar MQTT", command=self._toggle_mqtt).pack(side=tk.LEFT, padx=5)
        ttk.Button(frame_top, text="Config Broker", command=self._abrir_config).pack(side=tk.LEFT, padx=5)
        ttk.Button(frame_top, text="Firmware GW", command=self._abrir_config_gateway).pack(side=tk.LEFT, padx=5)

        self.lbl_resumen = ttk.Label(frame_top, text="", font=("Segoe UI", 9))
        self.lbl_resumen.pack(side=tk.LEFT, padx=20)

        self.lbl_packets = ttk.Label(frame_top, text="Enviados: 0 | CRC OK: 0", font=("Segoe UI", 9, "bold"))
        self.lbl_packets.pack(side=tk.RIGHT, padx=10)

        # Panel principal
        frame_main = ttk.Frame(self.root)
        frame_main.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        pane = ttk.PanedWindow(frame_main, orient=tk.HORIZONTAL)
        pane.pack(fill=tk.BOTH, expand=True)

        # --- PANEL IZQUIERDO: Lista de nodos ---
        frame_left = ttk.Frame(pane, width=320)
        pane.add(frame_left, weight=0)

        ttk.Label(frame_left, text="NODOS (doble clic = activar/desactivar)", font=("Segoe UI", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))

        frame_btn_nodes = ttk.Frame(frame_left)
        frame_btn_nodes.pack(fill=tk.X, pady=(0, 3))
        ttk.Button(frame_btn_nodes, text="+ Anadir", width=8, command=self._anadir_nodo).pack(side=tk.LEFT, padx=1)
        ttk.Button(frame_btn_nodes, text="Eliminar", width=8, command=self._eliminar_nodo).pack(side=tk.LEFT, padx=1)
        ttk.Button(frame_btn_nodes, text="Activar Todos", width=12, command=self._activar_todos).pack(side=tk.LEFT, padx=1)
        ttk.Button(frame_btn_nodes, text="Desactivar Todos", width=14, command=self._desactivar_todos).pack(side=tk.LEFT, padx=1)

        columns = ("nombre", "estado", "seq", "ultimo")
        self.tree_nodos = ttk.Treeview(frame_left, columns=columns, show="tree headings", height=12)
        self.tree_nodos.heading("#0", text="ID")
        self.tree_nodos.column("#0", width=40, minwidth=35)
        self.tree_nodos.heading("nombre", text="Nombre")
        self.tree_nodos.column("nombre", width=130, minwidth=100)
        self.tree_nodos.heading("estado", text="Estado")
        self.tree_nodos.column("estado", width=65, anchor=tk.CENTER)
        self.tree_nodos.heading("seq", text="Seq")
        self.tree_nodos.column("seq", width=40, anchor=tk.CENTER)
        self.tree_nodos.heading("ultimo", text="Ult. envio")
        self.tree_nodos.column("ultimo", width=100)
        self.tree_nodos.pack(fill=tk.BOTH, expand=True)
        self.tree_nodos.bind("<<TreeviewSelect>>", self._on_nodo_seleccionado)
        self.tree_nodos.bind("<Double-1>", self._on_nodo_doble_click)

        # Control individual de nodo seleccionado
        frame_toggle = ttk.Frame(frame_left)
        frame_toggle.pack(fill=tk.X, pady=3)
        self.btn_toggle = ttk.Button(frame_toggle, text="[Seleccione un nodo]", command=self._toggle_nodo_activo, state=tk.DISABLED)
        self.btn_toggle.pack(fill=tk.X)

        # Presets de ubicacion
        ttk.Label(frame_left, text="PRESETS UBICACION (click = asignar al nodo seleccionado)", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W, pady=(5, 2))
        frame_presets = tk.Frame(frame_left)
        frame_presets.pack(fill=tk.X)
        canvas = tk.Canvas(frame_presets, height=100)
        scroll_p = ttk.Scrollbar(frame_presets, orient=tk.VERTICAL, command=canvas.yview)
        scroll_frame = ttk.Frame(canvas)
        scroll_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=scroll_p.set)
        for nombre in sorted(PRESETS_UBICACION.keys()):
            btn = ttk.Button(scroll_frame, text=nombre, width=28,
                             command=lambda n=nombre: self._aplicar_preset(n))
            btn.pack(pady=1)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_p.pack(side=tk.RIGHT, fill=tk.Y)

        # --- PANEL DERECHO: Controles del nodo ---
        frame_right = ttk.Frame(pane)
        pane.add(frame_right, weight=1)
        self._crear_panel_nodo(frame_right)

        # --- PANEL INFERIOR: Control y log ---
        frame_bottom = ttk.Frame(self.root)
        frame_bottom.pack(fill=tk.BOTH, side=tk.BOTTOM, padx=5, pady=5)

        frame_control = ttk.Frame(frame_bottom)
        frame_control.pack(fill=tk.X)

        self.btn_iniciar = ttk.Button(frame_control, text="▶ INICIAR SIMULACION", command=self._toggle_simulacion)
        self.btn_iniciar.pack(side=tk.LEFT, padx=2)

        ttk.Label(frame_control, text="  Intervalo (ms):").pack(side=tk.LEFT, padx=(10, 2))
        self.var_intervalo = tk.StringVar(value=str(DEFAULT_INTERVAL_MS))
        ttk.Entry(frame_control, textvariable=self.var_intervalo, width=7).pack(side=tk.LEFT, padx=2)

        self.var_variacion = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame_control, variable=self.var_variacion, text="Variacion aleatoria").pack(side=tk.LEFT, padx=10)

        self.var_solo_activos = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame_control, variable=self.var_solo_activos,
                        text="Solo nodos activos", command=self._actualizar_lista_nodos).pack(side=tk.LEFT, padx=5)

        # Log
        frame_log = ttk.Frame(frame_bottom)
        frame_log.pack(fill=tk.BOTH, expand=True, pady=(5, 0))

        ttk.Label(frame_log, text="LOG DE ENVIO", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W)
        self.txt_log = tk.Text(frame_log, height=8, font=("Consolas", 9), wrap=tk.WORD)
        scroll_log = ttk.Scrollbar(frame_log, orient=tk.VERTICAL, command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=scroll_log.set)
        self.txt_log.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_log.pack(side=tk.RIGHT, fill=tk.Y)

    def _crear_panel_nodo(self, parent):
        self.frame_nodo = ttk.LabelFrame(parent, text="Seleccione un nodo", padding=10)
        self.frame_nodo.pack(fill=tk.BOTH, expand=True)
        self.nodo_widgets = {}
        row = 0

        ttk.Label(self.frame_nodo, text="Nombre:").grid(row=row, column=0, sticky=tk.W, pady=2)
        self.nodo_widgets["nombre"] = ttk.Entry(self.frame_nodo, width=25)
        self.nodo_widgets["nombre"].grid(row=row, column=1, columnspan=3, sticky=tk.W, pady=2)
        self.nodo_widgets["nombre"].bind("<FocusOut>", lambda e: self._on_nombre_change())
        self.nodo_widgets["nombre"].bind("<Return>", lambda e: self._on_nombre_change())

        row += 1
        ttk.Separator(self.frame_nodo, orient=tk.HORIZONTAL).grid(row=row, column=0, columnspan=5, sticky=tk.EW, pady=5)

        row += 1
        self._crear_fila_sensor(row, "Temperatura (C):", "temp", 15, 50, 25)

        row += 1
        self._crear_fila_sensor(row, "Humedad (%):", "hum", 0, 100, 60)

        row += 1
        self._crear_fila_sensor(row, "Calidad Aire (CO2):", "aq", 0, 1000, 340, fmt=".0f")

        row += 1
        self._crear_fila_sensor(row, "Nivel Llenado (cm):", "fill", 0, 200, 50)
        self.nodo_widgets["fill_pct"] = ttk.Label(self.frame_nodo, text="25%", foreground="gray")
        self.nodo_widgets["fill_pct"].grid(row=row, column=4, padx=2)

        row += 1
        self._crear_fila_sensor(row, "TOF (cm):", "tof", 1, 120, 80, fmt=".0f")

        row += 1
        ttk.Label(self.frame_nodo, text="IR (Obstaculo):").grid(row=row, column=0, sticky=tk.W, pady=2)
        self.nodo_widgets["ir"] = ttk.Checkbutton(self.frame_nodo, text="Colapsado",
            command=lambda: self._on_ir_change())
        self.nodo_widgets["ir"].grid(row=row, column=1, sticky=tk.W, pady=2)

        row += 1
        self._crear_fila_sensor(row, "Bateria (%):", "bateria", 0, 100, 100, fmt=".0f")

        row += 1
        self._crear_fila_sensor(row, "Senal RSSI (dBm):", "rssi", -120, -30, -60, fmt=".0f")

        row += 1
        self._crear_fila_sensor(row, "Ruido SNR (dB):", "snr", -15, 20, 8, fmt=".1f")

        row += 1
        ttk.Separator(self.frame_nodo, orient=tk.HORIZONTAL).grid(row=row, column=0, columnspan=5, sticky=tk.EW, pady=8)

        row += 1
        ttk.Label(self.frame_nodo, text="GPS", font=("Segoe UI", 10, "bold")).grid(row=row, column=0, sticky=tk.W, pady=2)

        row += 1
        self._crear_fila_sensor(row, "Latitud:", "lat", -16.5, -16.3, DEFAULT_LAT, 1000, ".4f")

        row += 1
        self._crear_fila_sensor(row, "Longitud:", "lon", -71.6, -71.4, DEFAULT_LON, 1000, ".4f")

        row += 1
        self._crear_fila_sensor(row, "Altitud (m):", "alt", 2000, 2500, DEFAULT_ALT, fmt=".0f")

        row += 1
        self._crear_fila_sensor(row, "Satelites:", "sats", 0, 20, 10, fmt=".0f")

        self._set_nodo_controls_state(tk.DISABLED)
        self.frame_nodo.grid_columnconfigure(2, weight=1)

    def _crear_fila_sensor(self, row, label, key, min_val, max_val, default, resolution=1, fmt=".1f"):
        ttk.Label(self.frame_nodo, text=label).grid(row=row, column=0, sticky=tk.W, pady=2)
        var = tk.DoubleVar(value=default)
        slider = ttk.Scale(self.frame_nodo, from_=min_val, to=max_val, orient=tk.HORIZONTAL,
                           variable=var, command=lambda *a: self._on_slider_change())
        slider.grid(row=row, column=1, columnspan=2, sticky=tk.EW, padx=5, pady=2)
        entry = ttk.Entry(self.frame_nodo, width=10, justify=tk.RIGHT)
        entry.insert(0, format(default, fmt))
        entry.grid(row=row, column=3, padx=2)
        entry.bind("<Return>", lambda e: self._on_entry_enter())
        entry.bind("<FocusOut>", lambda e: self._on_entry_enter())
        self.nodo_widgets[key] = var
        self.nodo_widgets[key + "_entry"] = entry

    def _on_nombre_change(self):
        if not self.nodo_seleccionado:
            return
        nuevo = self.nodo_widgets["nombre"].get().strip()
        if nuevo:
            self.nodo_seleccionado.nombre = nuevo
            self._actualizar_lista_nodos()

    def _on_ir_change(self):
        if not self.nodo_seleccionado:
            return
        n = self.nodo_seleccionado
        n.ir_obstaculo = "selected" in self.nodo_widgets["ir"].state()
        n.manual_override = True
        self._log(f"IR: {'Colapsado' if n.ir_obstaculo else 'Operativa'}")

    def _on_slider_change(self):
        if not self.nodo_seleccionado:
            return
        n = self.nodo_seleccionado
        n.manual_override = True
        n.temperatura = self.nodo_widgets["temp"].get()
        n.humedad = self.nodo_widgets["hum"].get()
        n.air_quality = self.nodo_widgets["aq"].get()
        n.fill_level = self.nodo_widgets["fill"].get()
        n.tof_mm = self.nodo_widgets["tof"].get()
        n.ir_obstaculo = "selected" in self.nodo_widgets["ir"].state()
        n.gps_lat = self.nodo_widgets["lat"].get()
        n.gps_lon = self.nodo_widgets["lon"].get()
        n.gps_alt = self.nodo_widgets["alt"].get()
        n.gps_sats = int(self.nodo_widgets["sats"].get())
        n.bateria = self.nodo_widgets["bateria"].get()
        n.rssi = self.nodo_widgets["rssi"].get()
        n.snr = self.nodo_widgets["snr"].get()

        self._actualizar_entries()
        pct = min(100, (n.fill_level / 200) * 100)
        self.nodo_widgets["fill_pct"].configure(text=f"{pct:.0f}%")

    def _actualizar_entries(self):
        if not self.nodo_seleccionado:
            return
        n = self.nodo_seleccionado
        fmt_map = {"temp":".0f","hum":".0f","aq":".0f","fill":".0f",
                   "tof":".0f","lat":".4f","lon":".4f","alt":".0f","sats":".0f",
                   "bateria":".0f","rssi":".0f","snr":".1f"}
        for key, fmt in fmt_map.items():
            attr = SENSOR_ATTR_MAP[key]
            val = getattr(n, attr)
            if key in ("sats", "bateria", "rssi"):
                val = int(val)
            entry = self.nodo_widgets.get(key + "_entry")
            if entry:
                entry.delete(0, tk.END)
                entry.insert(0, format(val, fmt))

    def _on_entry_enter(self):
        if not self.nodo_seleccionado:
            return
        n = self.nodo_seleccionado
        n.manual_override = True
        tipos = {"temp": float, "hum": float, "aq": int, "fill": float,
                 "tof": float, "lat": float, "lon": float, "alt": float, "sats": int,
                 "bateria": int, "rssi": int, "snr": float}
        for key, typ in tipos.items():
            entry = self.nodo_widgets.get(key + "_entry")
            if not entry:
                continue
            raw = entry.get().strip().replace(",", ".")
            try:
                val = typ(raw)
                setattr(n, SENSOR_ATTR_MAP[key], val)
                self.nodo_widgets[key].set(val)
            except ValueError:
                pass
        self._on_slider_change()

    def _set_nodo_controls_state(self, state):
        for key, widget in self.nodo_widgets.items():
            if isinstance(widget, ttk.Scale):
                widget.configure(state=state)
            if key.endswith("_entry"):
                widget.configure(state="normal" if state == tk.NORMAL else "disabled")

    # ---- LOGICA DE NODOS ----
    def _crear_nodo_inicial(self):
        nombres = [
            "Yanahuara", "Av. Ejercito", "Centro Historico", "Cayma", "Selva Alegre",
            "Cerro Colorado", "Paucarpata", "Jose Bustamante"
        ]
        for i, nombre in enumerate(nombres):
            preset = PRESETS_UBICACION.get(nombre, {})
            nodo = NodoSimulado(
                node_num=i + 2,
                nombre=nombre,
                lat=preset.get("lat"),
                lon=preset.get("lon"),
                fill_rate=TASAS_LLENADO.get(nombre, 8),
            )
            self.nodos.append(nodo)

    def _actualizar_lista_nodos(self):
        for item in self.tree_nodos.get_children():
            self.tree_nodos.delete(item)
        activos = 0
        for nodo in self.nodos:
            estado = "ACTIVO" if nodo.activo else "INACTIVO"
            ultimo = nodo.ultimo_envio[:30] + "..." if len(nodo.ultimo_envio) > 30 else nodo.ultimo_envio
            if nodo.activo:
                activos += 1
            if self.var_solo_activos.get() and not nodo.activo:
                continue
            tag = "activo" if nodo.activo else "inactivo"
            self.tree_nodos.insert("", tk.END, iid=nodo.node_id,
                                   text=nodo.node_id,
                                   values=(nodo.nombre, estado, nodo.seq, ultimo),
                                   tags=(tag,))
        self.tree_nodos.tag_configure("activo", background="#e8f5e9")
        self.tree_nodos.tag_configure("inactivo", background="#f5f5f5")
        total = len(self.nodos)
        self.lbl_resumen.configure(text=f"Activos: {activos}/{total}  |  Mostrando: {'solo activos' if self.var_solo_activos.get() else 'todos'}")

    def _toggle_nodo_activo(self):
        if not self.nodo_seleccionado:
            return
        self.nodo_seleccionado.activo = not self.nodo_seleccionado.activo
        estado = "ACTIVO" if self.nodo_seleccionado.activo else "INACTIVO"
        self.btn_toggle.configure(text=f"{self.nodo_seleccionado.node_id}: {estado}")
        self._actualizar_lista_nodos()
        self._log(f"Nodo {self.nodo_seleccionado.node_id} -> {estado}")

    def _activar_todos(self):
        for n in self.nodos:
            n.activo = True
        self._actualizar_lista_nodos()
        self._log("Todos los nodos activados")

    def _desactivar_todos(self):
        for n in self.nodos:
            n.activo = False
        self._actualizar_lista_nodos()
        self._log("Todos los nodos desactivados")

    def _anadir_nodo(self):
        num = max((n.node_num for n in self.nodos), default=0) + 1
        nodo = NodoSimulado(num, f"Contenedor {num}")
        self.nodos.append(nodo)
        self._actualizar_lista_nodos()
        self.tree_nodos.selection_set(nodo.node_id)
        self._on_nodo_seleccionado(None)
        self._log(f"Nodo {nodo.node_id} anadido")

    def _eliminar_nodo(self):
        sel = self.tree_nodos.selection()
        if not sel:
            messagebox.showwarning("Seleccionar", "Seleccione un nodo para eliminar")
            return
        node_id = sel[0]
        self.nodos = [n for n in self.nodos if n.node_id != node_id]
        self._actualizar_lista_nodos()
        if self.nodo_seleccionado and self.nodo_seleccionado.node_id == node_id:
            self.nodo_seleccionado = None
            self._limpiar_panel_nodo()
            self.btn_toggle.configure(text="[Seleccione un nodo]", state=tk.DISABLED)
        self._log(f"Nodo {node_id} eliminado")

    def _on_nodo_seleccionado(self, event):
        sel = self.tree_nodos.selection()
        if not sel:
            return
        node_id = sel[0]
        for n in self.nodos:
            if n.node_id == node_id:
                self.nodo_seleccionado = n
                estado = "ACTIVO" if n.activo else "INACTIVO"
                self.btn_toggle.configure(text=f"{n.node_id}: {estado}  [clic = invertir]", state=tk.NORMAL)
                self._cargar_nodo_en_panel(n)
                break

    def _on_nodo_doble_click(self, event):
        self._toggle_nodo_activo()

    def _cargar_nodo_en_panel(self, nodo: NodoSimulado):
        self.frame_nodo.configure(text=f"{nodo.node_id} - {nodo.nombre}")
        self._set_nodo_controls_state(tk.NORMAL)
        self.nodo_widgets["nombre"].delete(0, tk.END)
        self.nodo_widgets["nombre"].insert(0, nodo.nombre)
        self.nodo_widgets["temp"].set(nodo.temperatura)
        self.nodo_widgets["hum"].set(nodo.humedad)
        self.nodo_widgets["aq"].set(nodo.air_quality)
        self.nodo_widgets["fill"].set(nodo.fill_level)
        self.nodo_widgets["tof"].set(nodo.tof_mm)
        self.nodo_widgets["ir"].state(["selected" if nodo.ir_obstaculo else "!selected"])
        self.nodo_widgets["lat"].set(nodo.gps_lat)
        self.nodo_widgets["lon"].set(nodo.gps_lon)
        self.nodo_widgets["alt"].set(nodo.gps_alt)
        self.nodo_widgets["sats"].set(nodo.gps_sats)
        self.nodo_widgets["bateria"].set(nodo.bateria)
        self.nodo_widgets["rssi"].set(nodo.rssi)
        self.nodo_widgets["snr"].set(nodo.snr)
        self._actualizar_entries()
        pct = min(100, (nodo.fill_level / 200) * 100)
        self.nodo_widgets["fill_pct"].configure(text=f"{pct:.0f}%")

    def _limpiar_panel_nodo(self):
        self.frame_nodo.configure(text="Seleccione un nodo")
        self._set_nodo_controls_state(tk.DISABLED)
        self.nodo_widgets["nombre"].delete(0, tk.END)

    def _aplicar_preset(self, nombre):
        preset = PRESETS_UBICACION.get(nombre)
        if not preset:
            return
        if not self.nodo_seleccionado:
            messagebox.showinfo("Seleccionar nodo", "Seleccione un nodo primero")
            return
        self.nodo_seleccionado.gps_lat = preset["lat"]
        self.nodo_seleccionado.gps_lon = preset["lon"]
        self.nodo_seleccionado.nombre = nombre
        self.nodo_widgets["lat"].set(preset["lat"])
        self.nodo_widgets["lon"].set(preset["lon"])
        self._on_slider_change(0)
        self._log(f"Ubicacion '{nombre}' asignada a {self.nodo_seleccionado.node_id}")

    # ---- SIMULACION FISICA REALISTA ----
    def _actualizar_simulacion(self, nodo: NodoSimulado, dt_secs: float):
        if not self.var_variacion.get():
            return

        # Fill level siempre aumenta y hay recoleccion
        dt_hours = dt_secs / 3600.0
        incremento = nodo.fill_rate * dt_hours * random.uniform(0.85, 1.15)
        nodo.fill_level += incremento
        nodo.fill_level = min(200, nodo.fill_level)
        if nodo.fill_level > 30 and random.random() < 0.003 * (dt_secs / 5.0):
            nodo.fill_level = random.uniform(2, 12)
            nodo.ir_obstaculo = False
            nodo.seq = 0
            self._log(f"RECOLECCION: {nodo.node_id} ({nodo.nombre}) vaciado")

        if nodo.manual_override:
            return

        now = datetime.now()
        hour_dec = now.hour + now.minute / 60.0

        # Temperatura (°C): ciclo diurno 10-25°C tipico de Arequipa
        temp_base = 17.5 + 7.5 * math.sin(2 * math.pi * (hour_dec - 10) / 24)
        nodo.temperatura = round(temp_base + random.uniform(-0.8, 0.8), 1)
        nodo.temperatura = max(8, min(30, nodo.temperatura))

        # Humedad (%): inversamente proporcional a temperatura, 30-70%
        nodo.humedad = round(55 - (nodo.temperatura - 17.5) * 1.5 + random.uniform(-2, 2), 1)
        nodo.humedad = max(25, min(75, nodo.humedad))

        # Calidad del aire (raw ADC): sube con temperatura y llenado
        aq_base = 250
        if abs(hour_dec - 12) < 2 or abs(hour_dec - 19) < 2:
            aq_base += 120
        aq_base += (nodo.temperatura - 10) * 6
        aq_base += (nodo.fill_level / 200) * 200
        nodo.air_quality = int(aq_base + random.uniform(-15, 15))
        nodo.air_quality = max(0, min(1000, nodo.air_quality))

        # TOF (cm): inversamente proporcional al llenado (120 cm vacio, 1 cm lleno)
        nodo.tof_mm = round(120 - (nodo.fill_level / 200.0) * 119 + random.uniform(-0.5, 0.5), 1)
        nodo.tof_mm = max(1, min(120, nodo.tof_mm))

        # IR: probabilidad de obstaculo aumenta con el llenado
        ir_prob = nodo.fill_level / 300
        nodo.ir_obstaculo = random.random() < ir_prob

        # Satelites GPS: estables con pequena variacion
        nodo.gps_sats = random.randint(8, 14)

        # Batería disminuye lentamente
        nodo.bateria = max(0, min(100, nodo.bateria - random.uniform(0.001, 0.01)))

        # RSSI varía levemente con ruido
        nodo.rssi = max(-120, min(-30, nodo.rssi + random.randint(-1, 1)))

        # SNR varía levemente con ruido
        nodo.snr = max(-15.0, min(20.0, round(nodo.snr + random.uniform(-0.3, 0.3), 1)))

    # ---- SIMULACION ----
    def _toggle_simulacion(self):
        if self.corriendo:
            self.corriendo = False
            self.btn_iniciar.configure(text="▶ INICIAR SIMULACION")
            self._log("Simulacion detenida")
        else:
            activos = sum(1 for n in self.nodos if n.activo)
            if activos == 0:
                messagebox.showwarning("Sin nodos", "No hay nodos activos para simular.\nActive al menos un nodo.")
                return
            if not self.mqtt_conectado:
                if not self._mqtt_connect():
                    return
            for n in self.nodos:
                n.manual_override = False
            self.corriendo = True
            self.btn_iniciar.configure(text="■ DETENER SIMULACION")
            self._log(f"Simulacion iniciada con {activos} nodo(s) activos")
            self.thread_envio = threading.Thread(target=self._loop_envio, daemon=True)
            self.thread_envio.start()

    def _loop_envio(self):
        last_time = time.time()
        while self.corriendo:
            try:
                intervalo = int(self.var_intervalo.get())
                if intervalo < 200:
                    intervalo = 200
            except ValueError:
                intervalo = DEFAULT_INTERVAL_MS

            now = time.time()
            dt = now - last_time
            last_time = now

            for nodo in self.nodos:
                if not self.corriendo:
                    break
                if not nodo.activo:
                    continue

                self._actualizar_simulacion(nodo, dt)
                # Generar payload CSV para la UI del simulador
                csv_payload = nodo.generar_payload()
                topic = nodo.get_mqtt_topic("telemetry")

                # Serializar a formato JSON normalizado y estandarizado
                json_data = {
                    "sequence": nodo.seq,
                    "temperature": int(round(nodo.temperatura)),
                    "humidity": int(round(nodo.humedad)),
                    "air_quality": int(nodo.air_quality),
                    "ultrasonic_cm": int(round(nodo.fill_level)),
                    "tof_cm": int(nodo.tof_mm),
                    "obstacle": 1 if nodo.ir_obstaculo else 0,
                    "altitude": int(round(nodo.gps_alt)),
                    "satellites": int(nodo.gps_sats),
                    "battery": int(round(nodo.bateria)),
                    "rssi": int(round(nodo.rssi)),
                    "snr": float(round(nodo.snr, 1)),
                    "latitude": float(round(nodo.gps_lat, 6)),
                    "longitude": float(round(nodo.gps_lon, 6)),
                    "crc_ok": 1,
                    "crc_err": 0,
                    "pkts": nodo.seq
                }
                
                payload = json.dumps(json_data)
                ok = self._mqtt_publish(topic, payload)
                if ok:
                    self.packets_enviados += 1
                    self.crc_ok_count += 1

                self.root.after(0, lambda n=nodo, t=topic, p=payload, o=ok: self._after_envio(n, t, p, o))

            fin = time.time() + intervalo / 1000.0
            while self.corriendo and time.time() < fin:
                time.sleep(0.1)

    def _after_envio(self, nodo, topic, payload, ok):
        self._actualizar_lista_nodos()
        self._actualizar_stats()
        status = "OK" if ok else "FALLO"
        self._log(f"{nodo.node_id} [{status}] -> {topic}: {payload}")

    def _toggle_mqtt(self):
        if self.mqtt_conectado:
            if self.mqtt_client:
                self.mqtt_client.disconnect()
                self.mqtt_client.loop_stop()
                self.mqtt_client = None
            self.mqtt_conectado = False
            self._actualizar_estado_conexion()
            self._log("MQTT desconectado")
        else:
            if MQTT_AVAILABLE:
                self._mqtt_connect()
            else:
                self._log("paho-mqtt no disponible. pip install paho-mqtt")

    def _abrir_config(self):
        win = tk.Toplevel(self.root)
        win.title("Configuracion MQTT")
        win.geometry("420x320")
        win.transient(self.root)
        win.grab_set()

        ttk.Label(win, text="Configuracion del Broker MQTT", font=("Segoe UI", 10, "bold")).pack(pady=10)

        frame = ttk.Frame(win, padding=10)
        frame.pack(fill=tk.BOTH, expand=True)

        fields = [
            ("Broker:", MQTT_BROKER),
            ("Puerto:", str(MQTT_PORT)),
            ("Usuario:", MQTT_USER),
            ("Password:", MQTT_PASS),
            ("Gateway ID:", MQTT_GATEWAY_ID),
        ]
        entries = {}
        for i, (label, default) in enumerate(fields):
            ttk.Label(frame, text=label).grid(row=i, column=0, sticky=tk.W, pady=3)
            e = ttk.Entry(frame, width=30)
            e.insert(0, default)
            e.grid(row=i, column=1, padx=5, pady=3)
            entries[label] = e

        def guardar():
            broker = entries["Broker:"].get().strip()
            try:
                port = int(entries["Puerto:"].get().strip())
            except ValueError:
                messagebox.showerror("Error", "El puerto debe ser un numero entero.")
                return
            user = entries["Usuario:"].get().strip()
            passwd = entries["Password:"].get().strip()
            gateway_id = entries["Gateway ID:"].get().strip()

            global MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS, MQTT_GATEWAY_ID
            MQTT_BROKER = broker
            MQTT_PORT = port
            MQTT_USER = user
            MQTT_PASS = passwd
            MQTT_GATEWAY_ID = gateway_id

            cfg.MQTT_BROKER = broker
            cfg.MQTT_PORT = port
            cfg.MQTT_USER = user
            cfg.MQTT_PASS = passwd
            cfg.MQTT_GATEWAY_ID = gateway_id

            import os
            try:
                config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.py")
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    for line in lines:
                        if line.strip().startswith("MQTT_BROKER ="):
                            new_lines.append(f'MQTT_BROKER = "{broker}"\n')
                        elif line.strip().startswith("MQTT_PORT ="):
                            new_lines.append(f'MQTT_PORT = {port}\n')
                        elif line.strip().startswith("MQTT_USER ="):
                            new_lines.append(f'MQTT_USER = "{user}"\n')
                        elif line.strip().startswith("MQTT_PASS ="):
                            new_lines.append(f'MQTT_PASS = "{passwd}"\n')
                        elif line.strip().startswith("MQTT_GATEWAY_ID ="):
                            new_lines.append(f'MQTT_GATEWAY_ID = "{gateway_id}"\n')
                        else:
                            new_lines.append(line)
                            
                    with open(config_path, "w", encoding="utf-8") as f:
                        f.writelines(new_lines)
            except Exception as e:
                self._log(f"No se pudo guardar config.py en disco: {e}")

            if self.mqtt_conectado:
                self._toggle_mqtt()
            self._log("Configuracion guardada. Reconecte MQTT.")
            win.destroy()

        ttk.Button(win, text="Guardar y cerrar", command=guardar).pack(pady=10)

    def _abrir_config_gateway(self):
        win = tk.Toplevel(self.root)
        win.title("Configuracion Firmware Gateway")
        win.geometry("450x320")
        win.transient(self.root)
        win.grab_set()

        ttk.Label(win, text="Configuracion del Firmware de Gateway (gateway_02)", font=("Segoe UI", 10, "bold")).pack(pady=10)

        frame = ttk.Frame(win, padding=10)
        frame.pack(fill=tk.BOTH, expand=True)

        # Campos
        ttk.Label(frame, text="Direccion IP:").grid(row=0, column=0, sticky=tk.W, pady=5)
        ent_ip = ttk.Entry(frame, width=25)
        ent_ip.insert(0, self.gw_ip)
        ent_ip.grid(row=0, column=1, padx=5, pady=5)

        ttk.Label(frame, text="Version Firmware:").grid(row=1, column=0, sticky=tk.W, pady=5)
        ent_fw = ttk.Entry(frame, width=25)
        ent_fw.insert(0, self.gw_firmware)
        ent_fw.grid(row=1, column=1, padx=5, pady=5)

        ttk.Label(frame, text="Free Heap (bytes):").grid(row=2, column=0, sticky=tk.W, pady=5)
        ent_heap = ttk.Entry(frame, width=25)
        ent_heap.insert(0, str(self.gw_heap))
        ent_heap.grid(row=2, column=1, padx=5, pady=5)

        ttk.Label(frame, text="WiFi RSSI (dBm):").grid(row=3, column=0, sticky=tk.W, pady=5)
        ent_rssi = ttk.Entry(frame, width=25)
        ent_rssi.insert(0, str(self.gw_wifi_rssi))
        ent_rssi.grid(row=3, column=1, padx=5, pady=5)

        var_rand = tk.BooleanVar(value=self.gw_randomize)
        chk_rand = ttk.Checkbutton(frame, text="Variar Heap & RSSI aleatoriamente", variable=var_rand)
        chk_rand.grid(row=4, column=0, columnspan=2, sticky=tk.W, pady=5)

        def guardar():
            self.gw_ip = ent_ip.get().strip()
            self.gw_firmware = ent_fw.get().strip()
            try:
                self.gw_heap = int(ent_heap.get().strip())
                self.gw_wifi_rssi = int(ent_rssi.get().strip())
            except ValueError:
                messagebox.showerror("Error", "Heap y RSSI deben ser numeros enteros.")
                return
            self.gw_randomize = var_rand.get()
            
            # Publicar inmediatamente los nuevos parámetros si está conectado
            if self.mqtt_conectado:
                self._publicar_gateway_firmware(programar_siguiente=False)
                
            self._log("Parametros de firmware de gateway actualizados y publicados en tiempo real")
            win.destroy()

        ttk.Button(win, text="Guardar y Publicar", command=guardar).pack(pady=10)

    def _actualizar_estado_conexion(self):
        if self.mqtt_conectado:
            self.lbl_conexion.configure(text=f"Conectado a {MQTT_BROKER}:{MQTT_PORT}", foreground="green")
        else:
            self.lbl_conexion.configure(text="Desconectado", foreground="red")

    def _actualizar_stats(self):
        self.lbl_packets.configure(text=f"Enviados: {self.packets_enviados} | CRC OK: {self.crc_ok_count}")

    def _log(self, msg):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.root.after(0, lambda: self._append_log(f"[{timestamp}] {msg}\n"))

    def _append_log(self, text):
        self.txt_log.insert(tk.END, text)
        self.txt_log.see(tk.END)
        if int(self.txt_log.index("end-1c").split(".")[0]) > 200:
            self.txt_log.delete("1.0", "100.0")

    def run(self):
        self.root.mainloop()


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    app = SimuladorApp()
    app.run()
