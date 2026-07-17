#!/usr/bin/env python3
import time
import json
import random
import sys
import os
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

try:
    import paho.mqtt.client as mqtt
except ImportError:
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror(
        "Error de dependencias",
        "La biblioteca 'paho-mqtt' no está instalada.\n\n"
        "Instálala ejecutando en tu terminal:\npip install paho-mqtt"
    )
    sys.exit(1)

try:
    import tkintermapview
except ImportError:
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror(
        "Error de dependencias",
        "La biblioteca 'tkintermapview' no está instalada.\n\n"
        "Instálala ejecutando en tu terminal:\npip install tkintermapview"
    )
    sys.exit(1)

# Simulated route locations keypoints (Arequipa, Peru)
LOCATIONS = [
    "Base Central - Salida",
    "Plaza de Armas, Centro Histórico",
    "Calle Mercaderes, Comercio",
    "Av. Ejército 402, Yanahuara",
    "Mirador de Yanahuara, Vista",
    "Taller de Mantenimiento Norte",
    "Estación de Servicio - Carga",
    "Base Central - Retorno"
]

# Coordinate keypoints matching Arequipa Cercado & Yanahuara
ROUTE_COORDINATES = [
    (-16.4090, -71.5370), # Base Central
    (-16.4120, -71.5360), # Plaza de Armas
    (-16.4050, -71.5300), # Calle Mercaderes
    (-16.4000, -71.5350), # Av. Ejército 402
    (-16.3920, -71.5420), # Mirador Yanahuara
    (-16.3850, -71.5450), # Taller Mantenimiento
    (-16.3950, -71.5390), # Estación de Servicio
    (-16.4090, -71.5370)  # Retorno a Base
]

STATUS_OPTIONS = [
    "Available",
    "In Route",
    "Maintenance",
    "Low Fuel"
]

# Helper to smoothly interpolate coordinates between keypoints
def interpolate_coordinates(coord1, coord2, steps=15):
    lat1, lng1 = coord1
    lat2, lng2 = coord2
    points = []
    for i in range(steps):
        alpha = i / steps
        lat = lat1 + alpha * (lat2 - lat1)
        lng = lng1 + alpha * (lng2 - lng1)
        points.append((lat, lng))
    return points

class FleetSimulatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Centro de Control y Monitoreo SCADA - Inyección IoT GIS")
        self.root.geometry("1340x920")
        self.root.configure(bg="#0F172A")
        self.root.resizable(True, True)

        # Style configurations
        self.style = ttk.Style()
        self.style.theme_use("clam")
        
        # Color palette (Slate Corporate Aesthetics)
        self.bg_dark = "#0F172A"       # Tailwind Slate 900
        self.bg_card = "#1E293B"       # Tailwind Slate 800
        self.accent_blue = "#3B82F6"    # Tailwind Blue 500
        self.accent_green = "#10B981"   # Tailwind Emerald 500
        self.accent_red = "#EF4444"     # Tailwind Red 500
        self.text_white = "#F8FAFC"     # Tailwind Slate 50
        self.text_muted = "#94A3B8"     # Tailwind Slate 400
        
        # Configure TTK widgets
        self.style.configure(".", background=self.bg_dark, foreground=self.text_white, font=("Segoe UI", 9))
        self.style.configure("TLabel", background=self.bg_dark, foreground=self.text_white, font=("Segoe UI", 10))
        self.style.configure("Card.TFrame", background=self.bg_card, relief="flat")
        self.style.configure("CardLabel.TLabel", background=self.bg_card, foreground=self.text_white)
        self.style.configure("Header.TLabel", background=self.bg_dark, foreground=self.accent_blue, font=("Segoe UI", 14, "bold"))
        self.style.configure("SubHeader.TLabel", background=self.bg_dark, foreground=self.text_muted, font=("Segoe UI", 9))
        
        # Clean corporate Entry & Combobox styling
        self.style.configure("TEntry", fieldbackground="#0f172a", foreground=self.text_white, insertcolor=self.accent_blue, bordercolor="#334155", lightcolor="#334155", darkcolor="#334155")
        self.style.map("TEntry", fieldbackground=[("disabled", "#1e293b"), ("active", "#0f172a")], foreground=[("disabled", "#94a3b8")])
        
        self.style.configure("TCombobox", fieldbackground="#0f172a", foreground=self.text_white, bordercolor="#334155", lightcolor="#334155", darkcolor="#334155", arrowcolor=self.accent_blue)
        self.style.map("TCombobox", fieldbackground=[("disabled", "#1e293b"), ("readonly", "#0f172a")], foreground=[("disabled", "#94a3b8"), ("readonly", self.text_white)])

        # Treeview Custom Slate Theme Configuration
        self.style.configure("Treeview", background="#1E293B", foreground="#F8FAFC", fieldbackground="#1E293B", rowheight=26, font=("Segoe UI", 9))
        self.style.configure("Treeview.Heading", background="#0F172A", foreground="#94A3B8", font=("Segoe UI", 9, "bold"), relief="flat")
        self.style.map("Treeview", background=[("selected", "#3B82F6")], foreground=[("selected", "#F8FAFC")])

        # MQTT Telemetry Metrics variables
        self.msg_counter = 0
        self.is_connected = False
        self.mqtt_client = None
        self.auto_mode = tk.BooleanVar(value=True)

        # Separate coordinates templates for default vehicle routes
        self.default_coords_t101 = ROUTE_COORDINATES
        
        self.default_coords_t102 = [
            (-16.4090, -71.5370), # Base Central
            (-16.4000, -71.5350), # Av. Ejército
            (-16.3920, -71.5420), # Mirador Yanahuara
            (-16.3850, -71.5450), # Taller Mantenimiento
            (-16.3950, -71.5390), # Estación de Servicio
            (-16.4090, -71.5370)  # Retorno a Base
        ]
        
        self.default_coords_t103 = [
            (-16.4090, -71.5370), # Base Central
            (-16.4120, -71.5360), # Plaza de Armas
            (-16.4050, -71.5300), # Calle Mercaderes
            (-16.3950, -71.5390), # Estación de Servicio
            (-16.4090, -71.5370)  # Retorno a Base
        ]
        
        def make_path(c_list):
            p = []
            for idx in range(len(c_list) - 1):
                p.extend(interpolate_coordinates(c_list[idx], c_list[idx+1], steps=15))
            p.append(c_list[-1])
            return p

        # Multi-vehicle database with individual routes
        self.vehicles = {
            "T-101": {
                "plate": "BC-1234",
                "driver": "Juan Pérez",
                "status": "In Route",
                "fuel": 75.0,
                "capacity": 85.0,
                "location": "Av. Ejército 402, Yanahuara (-16.400000, -71.535000)",
                "route_progress": 45,
                "lat": -16.4000,
                "lng": -71.5350,
                "speed": 64.0,
                "route_path": make_path(self.default_coords_t101),
                "is_custom": False
            },
            "T-102": {
                "plate": "XY-5678",
                "driver": "Carlos Ruiz",
                "status": "Available",
                "fuel": 92.0,
                "capacity": 0.0,
                "location": "Base Central - Salida (-16.409000, -71.537000)",
                "route_progress": 0,
                "lat": -16.4090,
                "lng": -71.5370,
                "speed": 0.0,
                "route_path": make_path(self.default_coords_t102),
                "is_custom": False
            },
            "T-103": {
                "plate": "LM-9012",
                "driver": "Manuel Torres",
                "status": "Maintenance",
                "fuel": 45.0,
                "capacity": 0.0,
                "location": "Base Central - Salida (-16.409000, -71.537000)",
                "route_progress": 0,
                "lat": -16.4090,
                "lng": -71.5370,
                "speed": 0.0,
                "route_path": make_path(self.default_coords_t103),
                "is_custom": False
            }
        }
        
        self.full_route_path = self.vehicles["T-101"]["route_path"]
        self.selected_vehicle_id = "T-101"
        self.markers = {}
        
        # Telemetry State variables bound to UI sliders
        self.fuel_var = tk.DoubleVar(value=75.0)
        self.capacity_var = tk.DoubleVar(value=85.0)
        self.speed_var = tk.DoubleVar(value=64.0)
        self.status_var = tk.StringVar(value="In Route")
        self.location_var = tk.StringVar(value="Av. Ejército 402, Yanahuara (-16.400000, -71.535000)")
        
        self.auto_timer_id = None
        self.is_custom_route = False
        self.custom_route_waypoints = []
        self.custom_waypoint_markers = []
        self.is_editing_route = False
        self.editor_path_line = None

        self.create_widgets()
        
    def create_stat_card(self, parent, title, value, accent_color):
        """Helper to create a beautiful flat bordered stat card for SCADA Dashboard"""
        card = tk.Frame(parent, bg="#1E293B", highlightbackground="#334155", highlightthickness=1)
        
        lbl_title = tk.Label(card, text=title, font=("Segoe UI Semibold", 8), bg="#1E293B", fg="#94A3B8")
        lbl_title.pack(anchor="w", padx=10, pady=(6, 2))
        
        lbl_val = tk.Label(card, text=value, font=("Consolas", 14, "bold"), bg="#1E293B", fg=accent_color)
        lbl_val.pack(anchor="w", padx=10, pady=(0, 6))
        
        return card, lbl_val

    def create_flat_button(self, parent, text, bg_color, command, state=tk.NORMAL):
        """Helper to create high-fidelity custom buttons with micro-animations"""
        btn = tk.Button(
            parent, text=text, bg=bg_color, fg=self.text_white, 
            activebackground=self.accent_blue, activeforeground=self.text_white,
            disabledforeground="#64748B", font=("Segoe UI", 9, "bold"),
            relief="flat", bd=0, cursor="hand2", command=command, state=state
        )
        
        def on_enter(e):
            if btn["state"] == tk.NORMAL:
                btn.config(bg="#3B82F6")
        def on_leave(e):
            if btn["state"] == tk.NORMAL:
                btn.config(bg=bg_color)
                
        btn.bind("<Enter>", on_enter)
        btn.bind("<Leave>", on_leave)
        return btn

    def create_flat_entry(self, parent, placeholder=""):
        """Helper to create sleek obsidian flat entries with border focus highlights"""
        entry = tk.Entry(
            parent, bg="#0F172A", fg=self.text_white, insertbackground=self.accent_blue,
            font=("Segoe UI", 9), relief="flat", highlightbackground="#334155",
            highlightcolor=self.accent_blue, highlightthickness=1
        )
        if placeholder:
            entry.insert(0, placeholder)
        return entry

    def create_widgets(self):
        # --- HEADER SECTION ---
        header_frame = tk.Frame(self.root, bg=self.bg_dark)
        header_frame.pack(fill="x", padx=25, pady=(15, 10))
        
        lbl_title = ttk.Label(header_frame, text="CONSOLA SCADA DE GESTIÓN TÁCTICA Y TELEMETRÍA IOT", style="Header.TLabel")
        lbl_title.pack(anchor="w")
        
        lbl_subtitle = ttk.Label(header_frame, text="Sistema centralizado de simulación geoespacial, inyección MQTT industrial y logs en vivo", style="SubHeader.TLabel")
        lbl_subtitle.pack(anchor="w")
        
        # Main layout split
        main_layout = tk.Frame(self.root, bg=self.bg_dark)
        main_layout.pack(fill="both", expand=True, padx=25, pady=(0, 15))
        
        # --- LEFT PANEL (Configs, Tabular Fleet Grid, Custom Router) ---
        left_panel = tk.Frame(main_layout, bg=self.bg_dark, width=450)
        left_panel.pack(side="left", fill="both", padx=(0, 10))
        left_panel.pack_propagate(False)
        
        # 1. Broker Config Card
        cfg_frame = ttk.Frame(left_panel, style="Card.TFrame", padding=12)
        cfg_frame.pack(fill="x", pady=(0, 8))
        
        ttk.Label(cfg_frame, text="ENLACE DE COMUNICACIÓN MQTT", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel").pack(anchor="w", pady=(0, 6))
        
        row_broker = tk.Frame(cfg_frame, bg=self.bg_card)
        row_broker.pack(fill="x", pady=2)
        ttk.Label(row_broker, text="Dirección IP:", style="CardLabel.TLabel", width=12, anchor="w").pack(side="left")
        self.ent_broker = self.create_flat_entry(row_broker, "192.168.100.52")
        self.ent_broker.pack(side="right", fill="x", expand=True)
        
        row_port = tk.Frame(cfg_frame, bg=self.bg_card)
        row_port.pack(fill="x", pady=2)
        ttk.Label(row_port, text="Puerto Red:", style="CardLabel.TLabel", width=12, anchor="w").pack(side="left")
        self.ent_port = self.create_flat_entry(row_port, "1883")
        self.ent_port.pack(side="right", fill="x", expand=True)
        
        self.btn_connect = self.create_flat_button(cfg_frame, "🔌 CONECTAR Y TRANSMITIR", "#1E293B", self.toggle_connection)
        self.btn_connect.config(highlightbackground="#334155", highlightthickness=1)
        self.btn_connect.pack(fill="x", pady=(8, 4), ipady=3)

        # Transmission metrics bar inside broker card
        metrics_bar = tk.Frame(cfg_frame, bg="#0F172A", highlightbackground="#334155", highlightthickness=1)
        metrics_bar.pack(fill="x", pady=(4, 0), ipady=3)
        
        lbl_msg = tk.Label(metrics_bar, text="Tramas:", font=("Segoe UI Semibold", 8), bg="#0F172A", fg=self.text_muted)
        lbl_msg.grid(row=0, column=0, padx=(8, 2), sticky="w")
        self.lbl_mqtt_counter = tk.Label(metrics_bar, text="0", font=("Consolas", 8, "bold"), bg="#0F172A", fg="#22D3EE")
        self.lbl_mqtt_counter.grid(row=0, column=1, padx=1, sticky="w")

        lbl_rate = tk.Label(metrics_bar, text="Tasa:", font=("Segoe UI Semibold", 8), bg="#0F172A", fg=self.text_muted)
        lbl_rate.grid(row=0, column=2, padx=(10, 2), sticky="w")
        self.lbl_mqtt_rate = tk.Label(metrics_bar, text="0 Hz", font=("Consolas", 8, "bold"), bg="#0F172A", fg=self.accent_green)
        self.lbl_mqtt_rate.grid(row=0, column=3, padx=1, sticky="w")

        lbl_net = tk.Label(metrics_bar, text="Enlace:", font=("Segoe UI Semibold", 8), bg="#0F172A", fg=self.text_muted)
        lbl_net.grid(row=0, column=4, padx=(10, 2), sticky="w")
        self.lbl_mqtt_status = tk.Label(metrics_bar, text="Desconectado", font=("Segoe UI", 8, "bold"), bg="#0F172A", fg=self.accent_red)
        self.lbl_mqtt_status.grid(row=0, column=5, padx=1, sticky="w")
        metrics_bar.columnconfigure(5, weight=1)
        
        # 2. Add New Truck Card
        add_frame = ttk.Frame(left_panel, style="Card.TFrame", padding=12)
        add_frame.pack(fill="x", pady=(0, 8))
        
        ttk.Label(add_frame, text="REGISTRO Y ALTA DE VEHÍCULO", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel").pack(anchor="w", pady=(0, 6))
        
        row_add_id = tk.Frame(add_frame, bg=self.bg_card)
        row_add_id.pack(fill="x", pady=2)
        ttk.Label(row_add_id, text="Cód. Unidad:", style="CardLabel.TLabel", width=12, anchor="w").pack(side="left")
        self.ent_add_id = self.create_flat_entry(row_add_id, "T-104")
        self.ent_add_id.pack(side="right", fill="x", expand=True)
        
        row_add_driver = tk.Frame(add_frame, bg=self.bg_card)
        row_add_driver.pack(fill="x", pady=2)
        ttk.Label(row_add_driver, text="Conductor:", style="CardLabel.TLabel", width=12, anchor="w").pack(side="left")
        self.ent_add_driver = self.create_flat_entry(row_add_driver, "Carlos Mendoza")
        self.ent_add_driver.pack(side="right", fill="x", expand=True)
        
        self.btn_add = self.create_flat_button(add_frame, "➕ CONFIGURAR Y AÑADIR A RUTA VIVA", "#3B82F6", self.add_new_vehicle)
        self.btn_add.pack(fill="x", pady=(8, 0), ipady=3)
  
        # 3. Route Editor Card
        rte_frame = ttk.Frame(left_panel, style="Card.TFrame", padding=12)
        rte_frame.pack(fill="x", pady=(0, 8))
        
        ttk.Label(rte_frame, text="CENTRO DE TRAZADO Y MODIFICACIÓN DE RUTA", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel").pack(anchor="w", pady=(0, 4))
        
        self.lbl_route_status = ttk.Label(rte_frame, text="Ruta activa: AREQUIPA CERCADO (Predeterminada)", font=("Segoe UI", 8, "italic"), foreground=self.text_muted, wraplength=410, justify="left")
        self.lbl_route_status.pack(anchor="w", pady=(0, 8))
        
        # Row 1 of buttons
        row_btn1 = tk.Frame(rte_frame, bg=self.bg_card)
        row_btn1.pack(fill="x", pady=2)
        
        self.btn_design_route = self.create_flat_button(row_btn1, "📝 DISEÑAR RUTA", "#475569", self.start_design_route)
        self.btn_design_route.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=2)
        
        self.btn_apply_route = self.create_flat_button(row_btn1, "💾 APLICAR RUTA", self.accent_green, self.apply_custom_route, state=tk.DISABLED)
        self.btn_apply_route.pack(side="right", fill="x", expand=True, padx=(4, 0), ipady=2)
        
        # Row 2 of buttons
        row_btn2 = tk.Frame(rte_frame, bg=self.bg_card)
        row_btn2.pack(fill="x", pady=2)
        
        self.btn_clear_draft = self.create_flat_button(row_btn2, "🧹 LIMPIAR BORRADOR", "#64748B", self.clear_draft_route)
        self.btn_clear_draft.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=2)
        
        self.btn_restore_default = self.create_flat_button(row_btn2, "🔄 RESTAURAR PRED.", "#1E293B", self.restore_default_route)
        self.btn_restore_default.config(highlightbackground="#334155", highlightthickness=1)
        self.btn_restore_default.pack(side="right", fill="x", expand=True, padx=(4, 0), ipady=2)
        
        # 4. Tabular Fleet Grid Card (ttk.Treeview)
        list_frame = ttk.Frame(left_panel, style="Card.TFrame", padding=12)
        list_frame.pack(fill="both", expand=True)
        
        ttk.Label(list_frame, text="MATRIZ DE MONITOREO EN TIEMPO REAL - FLOTA", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel").pack(anchor="w", pady=(0, 6))
        
        # Scrollable Treeview Container
        tree_container = tk.Frame(list_frame, bg=self.bg_card)
        tree_container.pack(fill="both", expand=True, pady=1)
        
        self.tree_vehicles = ttk.Treeview(
            tree_container,
            columns=("id", "driver", "status", "fuel", "capacity", "speed"),
            show="headings",
            selectmode="browse"
        )
        
        # Headers definitions
        self.tree_vehicles.heading("id", text="Unidad", anchor="w")
        self.tree_vehicles.heading("driver", text="Conductor", anchor="w")
        self.tree_vehicles.heading("status", text="Estado", anchor="center")
        self.tree_vehicles.heading("fuel", text="Comb.", anchor="center")
        self.tree_vehicles.heading("capacity", text="Carga", anchor="center")
        self.tree_vehicles.heading("speed", text="Velocidad", anchor="center")
        
        # Columns widths & alignments
        self.tree_vehicles.column("id", width=55, minwidth=50, anchor="w")
        self.tree_vehicles.column("driver", width=100, minwidth=90, anchor="w")
        self.tree_vehicles.column("status", width=95, minwidth=85, anchor="center")
        self.tree_vehicles.column("fuel", width=50, minwidth=45, anchor="center")
        self.tree_vehicles.column("capacity", width=50, minwidth=45, anchor="center")
        self.tree_vehicles.column("speed", width=75, minwidth=70, anchor="center")
        
        # Scrollbar vertical
        scrollbar = ttk.Scrollbar(tree_container, orient="vertical", command=self.tree_vehicles.yview)
        self.tree_vehicles.configure(yscrollcommand=scrollbar.set)
        
        self.tree_vehicles.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        self.tree_vehicles.bind("<<TreeviewSelect>>", self.on_treeview_select)
        
        self.btn_remove = self.create_flat_button(list_frame, "🚨 RETIRAR VEHÍCULO DEL SISTEMA", self.accent_red, self.remove_selected_vehicle)
        self.btn_remove.pack(fill="x", pady=(6, 0), ipady=2)
        
        self.update_treeview()
 
        # --- RIGHT PANEL (Dashboard, Sliders, Map, Colored logs) ---
        right_panel = tk.Frame(main_layout, bg=self.bg_dark)
        right_panel.pack(side="left", fill="both", expand=True, padx=(10, 0))
        
        # --- 1. GENERAL STATISTICS DASHBOARD (SCADA Grid Row) ---
        stats_row = tk.Frame(right_panel, bg=self.bg_dark)
        stats_row.pack(fill="x", pady=(0, 10))
        
        # Configure columns equally
        for i in range(6):
            stats_row.columnconfigure(i, weight=1, uniform="equal")
            
        self.card_total, self.lbl_stat_total = self.create_stat_card(stats_row, "UNIDADES TOTALES", "3", self.accent_blue)
        self.card_total.grid(row=0, column=0, padx=(0, 4), sticky="nsew")
        
        self.card_route, self.lbl_stat_route = self.create_stat_card(stats_row, "EN TRÁNSITO (RUTA)", "1", "#22D3EE")
        self.card_route.grid(row=0, column=1, padx=4, sticky="nsew")
        
        self.card_avail, self.lbl_stat_avail = self.create_stat_card(stats_row, "DISPONIBLES (BASE)", "1", self.accent_green)
        self.card_avail.grid(row=0, column=2, padx=4, sticky="nsew")
        
        self.card_maint, self.lbl_stat_maint = self.create_stat_card(stats_row, "EN MANTENIMIENTO", "1", "#F59E0B")
        self.card_maint.grid(row=0, column=3, padx=4, sticky="nsew")
        
        self.card_fuel, self.lbl_stat_fuel = self.create_stat_card(stats_row, "COMBUSTIBLE MEDIO", "70.7%", self.accent_green)
        self.card_fuel.grid(row=0, column=4, padx=4, sticky="nsew")
        
        self.card_speed, self.lbl_stat_speed = self.create_stat_card(stats_row, "VELOCIDAD MEDIA", "21.3 km/h", self.accent_blue)
        self.card_speed.grid(row=0, column=5, padx=(4, 0), sticky="nsew")
        
        # --- 2. CONTROL CARD FOR VEHICLE TELEMETRY ---
        ctrl_frame = ttk.Frame(right_panel, style="Card.TFrame", padding=12)
        ctrl_frame.pack(fill="both", expand=True)
        
        # Unit control status header
        status_line = tk.Frame(ctrl_frame, bg=self.bg_card)
        status_line.pack(fill="x", pady=(0, 10))
        
        self.lbl_panel_title = ttk.Label(status_line, text=f"MONITOREO DE PARÁMETROS UNITARIOS: CAMIÓN {self.selected_vehicle_id}", font=("Segoe UI", 10, "bold"), style="CardLabel.TLabel")
        self.lbl_panel_title.pack(side="left")
        
        # LED state indicator
        self.canvas_led = tk.Canvas(status_line, width=15, height=15, bg=self.bg_card, highlightthickness=0)
        self.canvas_led.pack(side="right", padx=5)
        self.led_oval = self.canvas_led.create_oval(2, 2, 13, 13, fill=self.text_muted)
        
        self.lbl_transmission_state = ttk.Label(status_line, text="DESCONECTADO", font=("Segoe UI", 9, "bold"), foreground=self.text_muted, style="CardLabel.TLabel")
        self.lbl_transmission_state.pack(side="right")
        
        # Sliders layout
        sliders_frame = tk.Frame(ctrl_frame, bg=self.bg_card)
        sliders_frame.pack(fill="x", pady=(0, 5))
        
        # Sliders: Speed, Fuel, Capacity
        lbl_row_speed = tk.Frame(sliders_frame, bg=self.bg_card)
        lbl_row_speed.pack(fill="x", pady=1)
        ttk.Label(lbl_row_speed, text="Velocidad manual de la unidad (km/h):", style="CardLabel.TLabel").pack(side="left")
        self.lbl_speed_val = ttk.Label(lbl_row_speed, text="64.0 km/h", style="CardLabel.TLabel", font=("Segoe UI", 10, "bold"), foreground=self.accent_blue)
        self.lbl_speed_val.pack(side="right")
        self.scale_speed = ttk.Scale(sliders_frame, from_=0.0, to=120.0, variable=self.speed_var, command=self.update_speed_label)
        self.scale_speed.pack(fill="x", pady=(0, 6))
        
        lbl_row_fuel = tk.Frame(sliders_frame, bg=self.bg_card)
        lbl_row_fuel.pack(fill="x", pady=1)
        ttk.Label(lbl_row_fuel, text="Nivel de depósito de combustible (%):", style="CardLabel.TLabel").pack(side="left")
        self.lbl_fuel_val = ttk.Label(lbl_row_fuel, text="75.0%", style="CardLabel.TLabel", font=("Segoe UI", 10, "bold"), foreground=self.accent_green)
        self.lbl_fuel_val.pack(side="right")
        self.scale_fuel = ttk.Scale(sliders_frame, from_=0.0, to=100.0, variable=self.fuel_var, command=self.update_fuel_label)
        self.scale_fuel.pack(fill="x", pady=(0, 6))
        
        lbl_row_cap = tk.Frame(sliders_frame, bg=self.bg_card)
        lbl_row_cap.pack(fill="x", pady=1)
        ttk.Label(lbl_row_cap, text="Nivel de llenado del contenedor (%):", style="CardLabel.TLabel").pack(side="left")
        self.lbl_cap_val = ttk.Label(lbl_row_cap, text="85.0%", style="CardLabel.TLabel", font=("Segoe UI", 10, "bold"), foreground="#FFA726")
        self.lbl_cap_val.pack(side="right")
        self.scale_cap = ttk.Scale(sliders_frame, from_=0.0, to=100.0, variable=self.capacity_var, command=self.update_cap_label)
        self.scale_cap.pack(fill="x", pady=(0, 8))
        
        # Operational parameters selection dropdowns
        drops_frame = tk.Frame(ctrl_frame, bg=self.bg_card)
        drops_frame.pack(fill="x", pady=(0, 8))
        
        tk.Label(drops_frame, text="Estado operativo asignado:", bg=self.bg_card, fg=self.text_white, anchor="w").grid(row=0, column=0, sticky="w", padx=(0, 10))
        self.cb_status = ttk.Combobox(drops_frame, values=STATUS_OPTIONS, textvariable=self.status_var, state="readonly")
        self.cb_status.grid(row=1, column=0, sticky="ew", pady=(0, 4), padx=(0, 15))
        self.cb_status.bind("<<ComboboxSelected>>", self.on_status_change)
        
        tk.Label(drops_frame, text="Sector geográfico de ruta:", bg=self.bg_card, fg=self.text_white, anchor="w").grid(row=0, column=1, sticky="w")
        self.cb_location = ttk.Combobox(drops_frame, values=LOCATIONS, textvariable=self.location_var, state="normal")
        self.cb_location.grid(row=1, column=1, sticky="ew", pady=(0, 4))
        self.cb_location.bind("<FocusOut>", self.on_location_change)
        self.cb_location.bind("<<ComboboxSelected>>", self.on_location_change)
        
        drops_frame.columnconfigure(0, weight=1)
        drops_frame.columnconfigure(1, weight=1)
        
        # --- 3. GEOGRAPHICAL GIS MAP SECTION ---
        map_title_frame = tk.Frame(ctrl_frame, bg=self.bg_card)
        map_title_frame.pack(fill="x", pady=(2, 2))
        ttk.Label(map_title_frame, text="INTERFAZ DE VISTA GEOGRÁFICA (GIS) - AREQUIPA CERCADO", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel", foreground=self.accent_blue).pack(side="left")
        
        map_card = ttk.Frame(ctrl_frame, style="Card.TFrame", padding=1)
        map_card.pack(fill="both", expand=True, pady=(0, 6))
        
        self.map_widget = tkintermapview.TkinterMapView(
            map_card, 
            height=340, 
            corner_radius=8,
            bg_color=self.bg_card
        )
        self.map_widget.pack(fill="both", expand=True)
        self.map_widget.set_position(-16.39889, -71.53500) # Centered in Arequipa, Peru
        self.map_widget.set_zoom(13)
        self.map_widget.add_left_click_map_command(self.on_map_click)
        
        # Map route path lines tracing
        self.map_path = self.map_widget.set_path(self.full_route_path, color=self.accent_blue, width=3)
        
        # Checkbox for automatic simulation toggle
        chk_auto = tk.Checkbutton(
            ctrl_frame, text="Habilitar ciclo de simulación y telemetría automática en paralelo para toda la flota",
            variable=self.auto_mode, bg=self.bg_card, fg=self.accent_blue,
            selectcolor=self.bg_card, font=("Segoe UI", 9, "bold"),
            activebackground=self.bg_card, activeforeground=self.accent_blue,
            command=self.toggle_auto_mode
        )
        chk_auto.pack(anchor="w", pady=2)
        
        # --- 4. COLOURED TELEMETRY LOG VISOR ---
        logs_header = tk.Frame(ctrl_frame, bg=self.bg_card)
        logs_header.pack(fill="x", pady=(4, 2))
        ttk.Label(logs_header, text="TERMINAL DE REGISTRO DE PAYLOADS MQTT Y TELEMETRÍA IOT", font=("Segoe UI", 9, "bold"), style="CardLabel.TLabel", foreground=self.accent_blue).pack(side="left")
        
        self.txt_logs = scrolledtext.ScrolledText(ctrl_frame, height=5, bg="#0B0F19", fg="#F8FAFC", insertbackground="white", font=("Consolas", 8), relief="flat")
        self.txt_logs.pack(fill="both", expand=True)
        
        # Setup ScrolledText ANSI logging color tags
        self.txt_logs.tag_config("time", foreground="#64748B")
        self.txt_logs.tag_config("system", foreground="#F59E0B", font=("Consolas", 8, "bold"))
        self.txt_logs.tag_config("sent", foreground="#22D3EE")
        self.txt_logs.tag_config("mqtt", foreground="#34D399", font=("Consolas", 8, "bold"))
        self.txt_logs.tag_config("route", foreground="#C084FC")
        self.txt_logs.tag_config("error", foreground="#F87171", font=("Consolas", 8, "bold"))
        self.txt_logs.tag_config("default", foreground="#F8FAFC")
        
        self.write_log("SYSTEM", "Consola SCADA de Gestión de Flota inicializada con éxito. Conéctese para inyección IoT...")
        
        # Initialize map markers & UI stats
        self.update_map_markers()
        self.update_global_stats()
        
        # Disable controls initially until connected
        self.set_controls_state("disabled")

    def start_design_route(self):
        self.is_editing_route = True
        self.custom_route_waypoints = []
        
        # Clear draft markers
        for m in self.custom_waypoint_markers:
            m.delete()
        self.custom_waypoint_markers = []
        
        if self.editor_path_line:
            self.editor_path_line.delete()
            self.editor_path_line = None
            
        self.btn_apply_route.configure(state=tk.NORMAL)
        self.lbl_route_status.configure(
            text=f"Modo Trazado ({self.selected_vehicle_id}): Haz clic izquierdo en el visor geográfico...",
            foreground=self.accent_blue
        )
        self.write_log("ROUTE", f"Modo diseño interactivo activado para la unidad {self.selected_vehicle_id}. Dibuje la trayectoria en el mapa.")

    def on_map_click(self, coordinate):
        if not self.is_editing_route:
            return
            
        lat, lng = coordinate
        self.custom_route_waypoints.append((lat, lng))
        
        # Draw a custom numbered waypoint node circle
        marker = self.map_widget.set_marker(
            lat, lng, 
            text=f"P{len(self.custom_route_waypoints)}",
            text_color="#F8FAFC",
            marker_color_circle=self.accent_blue
        )
        self.custom_waypoint_markers.append(marker)
        
        # Draw path connecting draft waypoints
        if len(self.custom_route_waypoints) >= 2:
            if self.editor_path_line:
                self.editor_path_line.delete()
            self.editor_path_line = self.map_widget.set_path(self.custom_route_waypoints, color=self.accent_blue, width=2)
            
        self.lbl_route_status.configure(
            text=f"Modo Trazado ({self.selected_vehicle_id}): {len(self.custom_route_waypoints)} nodos de control en borrador.",
            foreground=self.accent_blue
        )
        self.write_log("ROUTE", f"Nodo de control #{len(self.custom_route_waypoints)} posicionado en ({lat:.5f}, {lng:.5f}) para {self.selected_vehicle_id}")

    def apply_custom_route(self):
        if len(self.custom_route_waypoints) < 2:
            messagebox.showwarning(
                "Nodos insuficientes",
                "Por favor, trace al menos 2 nodos de control en el visor de mapa antes de aplicar la trayectoria."
            )
            return
            
        self.is_editing_route = False
        
        # Clear draft visual elements
        for m in self.custom_waypoint_markers:
            m.delete()
        self.custom_waypoint_markers = []
        
        if self.editor_path_line:
            self.editor_path_line.delete()
            self.editor_path_line = None
            
        # Delete old route path
        if hasattr(self, "map_path") and self.map_path:
            self.map_path.delete()
            
        # Interpolate coordinates between selected points
        new_path = []
        for idx in range(len(self.custom_route_waypoints) - 1):
            new_path.extend(
                interpolate_coordinates(
                    self.custom_route_waypoints[idx],
                    self.custom_route_waypoints[idx+1],
                    steps=15
                )
            )
        new_path.append(self.custom_route_waypoints[-1])
        
        # Assign new custom path to selected vehicle
        vdata = self.vehicles[self.selected_vehicle_id]
        vdata["route_path"] = new_path
        vdata["route_progress"] = 0
        vdata["lat"] = new_path[0][0]
        vdata["lng"] = new_path[0][1]
        vdata["is_custom"] = True
        vdata["custom_waypoints"] = list(self.custom_route_waypoints)
        vdata["location"] = f"Trayecto Pers. - Nodo 1 ({vdata['lat']:.6f}, {vdata['lng']:.6f})"
        
        # Set new path line on map
        self.map_path = self.map_widget.set_path(new_path, color=self.accent_blue, width=3)
        
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_map_markers()
        self.update_treeview()
        self.update_global_stats()
        
        self.btn_apply_route.configure(state=tk.DISABLED)
        self.lbl_route_status.configure(
            text=f"Ruta {self.selected_vehicle_id}: PERSONALIZADA ({len(new_path)} puntos)",
            foreground=self.accent_green
        )
        self.write_log("ROUTE", f"Trayectoria geoespacial personalizada aplicada a {self.selected_vehicle_id}. {len(self.custom_route_waypoints)} nodos, {len(new_path)} coordenadas interpoladas.")

    def clear_draft_route(self):
        self.custom_route_waypoints = []
        for m in self.custom_waypoint_markers:
            m.delete()
        self.custom_waypoint_markers = []
        
        if self.editor_path_line:
            self.editor_path_line.delete()
            self.editor_path_line = None
            
        self.lbl_route_status.configure(
            text="Borrador limpio. Haz clic izquierdo en el visor para trazar.",
            foreground=self.text_muted
        )
        self.write_log("ROUTE", f"Borrador de trazado limpiado para {self.selected_vehicle_id}.")

    def restore_default_route(self):
        self.is_editing_route = False
        self.custom_route_waypoints = []
        
        for m in self.custom_waypoint_markers:
            m.delete()
        self.custom_waypoint_markers = []
        
        if self.editor_path_line:
            self.editor_path_line.delete()
            self.editor_path_line = None
            
        if hasattr(self, "map_path") and self.map_path:
            self.map_path.delete()
            
        # Re-initialize default path for selected vehicle
        vdata = self.vehicles[self.selected_vehicle_id]
        vdata["is_custom"] = False
        
        if self.selected_vehicle_id == "T-101":
            coords = self.default_coords_t101
            route_name = "AREQUIPA CERCADO (Predet. T-101)"
        elif self.selected_vehicle_id == "T-102":
            coords = self.default_coords_t102
            route_name = "YANAHUARA NORTE (Predet. T-102)"
        elif self.selected_vehicle_id == "T-103":
            coords = self.default_coords_t103
            route_name = "CERCADO SUR (Predet. T-103)"
        else:
            coords = ROUTE_COORDINATES
            route_name = "AREQUIPA CERCADO (Predet.)"
            
        def make_path(c_list):
            p = []
            for idx in range(len(c_list) - 1):
                p.extend(interpolate_coordinates(c_list[idx], c_list[idx+1], steps=15))
            p.append(c_list[-1])
            return p
            
        vdata["route_path"] = make_path(coords)
        
        # Reset positions for selected vehicle
        start_progress = random.randint(0, len(vdata["route_path"]) - 1)
        lat, lng = vdata["route_path"][start_progress]
        vdata["route_progress"] = start_progress
        vdata["lat"] = lat
        vdata["lng"] = lng
        
        sector = "Cercado Arequipa"
        if start_progress < 15:
            sector = "Base Central"
        elif start_progress < 30:
            sector = "Plaza de Armas"
        elif start_progress < 45:
            sector = "Calle Mercaderes"
        elif start_progress < 60:
            sector = "Av. Ejército"
        elif start_progress < 75:
            sector = "Mirador Yanahuara"
        elif start_progress < 90:
            sector = "Taller Norte"
        else:
            sector = "Estación Servicio"
            
        vdata["location"] = f"{sector} ({lat:.6f}, {lng:.6f})"
        self.publish_vehicle_state(self.selected_vehicle_id)
        
        self.map_path = self.map_widget.set_path(vdata["route_path"], color=self.accent_blue, width=3)
        self.update_map_markers()
        self.update_treeview()
        self.update_global_stats()
        
        self.btn_apply_route.configure(state=tk.DISABLED)
        self.lbl_route_status.configure(
            text=f"Ruta activa: {route_name}",
            foreground=self.text_muted
        )
        self.write_log("ROUTE", f"Restaurada la trayectoria predeterminada de fábrica para {self.selected_vehicle_id}.")

    def update_treeview(self):
        existing_iids = self.tree_vehicles.get_children()
        
        # Remove old rows not in vehicles db
        for iid in existing_iids:
            if iid not in self.vehicles:
                self.tree_vehicles.delete(iid)
                
        # Insert or update columns
        for vid, vdata in self.vehicles.items():
            fuel_str = f"{vdata['fuel']:.1f}%"
            cap_str = f"{vdata['capacity']:.1f}%"
            speed_str = f"{vdata['speed']:.1f} km/h"
            
            status_map = {
                "Available": "Disponible",
                "In Route": "En Ruta",
                "Maintenance": "Mantenimiento",
                "Low Fuel": "Bajo Comb."
            }
            status_text = status_map.get(vdata["status"], vdata["status"])
            
            values = (vid, vdata["driver"], status_text, fuel_str, cap_str, speed_str)
            
            if self.tree_vehicles.exists(vid):
                self.tree_vehicles.item(vid, values=values)
            else:
                self.tree_vehicles.insert("", tk.END, iid=vid, values=values)
                
        # Sync selected visual highlight row with selected vehicle ID
        selected_rows = self.tree_vehicles.selection()
        if not selected_rows or selected_rows[0] != self.selected_vehicle_id:
            if self.tree_vehicles.exists(self.selected_vehicle_id):
                self.tree_vehicles.unbind("<<TreeviewSelect>>")
                self.tree_vehicles.selection_set(self.selected_vehicle_id)
                self.tree_vehicles.bind("<<TreeviewSelect>>", self.on_treeview_select)

    def update_global_stats(self):
        """Recalculate global indicators of the telemetry network"""
        total_units = len(self.vehicles)
        if total_units == 0:
            return
            
        in_route = sum(1 for v in self.vehicles.values() if v["status"] == "In Route")
        available = sum(1 for v in self.vehicles.values() if v["status"] == "Available")
        maintenance = sum(1 for v in self.vehicles.values() if v["status"] == "Maintenance")
        
        avg_fuel = sum(v["fuel"] for v in self.vehicles.values()) / total_units
        avg_speed = sum(v["speed"] for v in self.vehicles.values()) / total_units
        
        self.lbl_stat_total.configure(text=str(total_units))
        self.lbl_stat_route.configure(text=str(in_route))
        self.lbl_stat_avail.configure(text=str(available))
        self.lbl_stat_maint.configure(text=str(maintenance))
        self.lbl_stat_fuel.configure(text=f"{avg_fuel:.1f}%")
        self.lbl_stat_speed.configure(text=f"{avg_speed:.1f} km/h")

    def update_map_markers(self):
        for vid, vdata in self.vehicles.items():
            lat, lng = vdata["lat"], vdata["lng"]
            # Color coding markers based on status
            m_color = self.accent_blue
            if vdata["status"] == "Low Fuel":
                m_color = self.accent_red
            elif vdata["status"] == "Maintenance":
                m_color = "#FFA726"
            elif vdata["status"] == "Available":
                m_color = self.accent_green
                
            if vid in self.markers:
                self.markers[vid].set_position(lat, lng)
            else:
                self.markers[vid] = self.map_widget.set_marker(
                    lat, lng, 
                    text=vid, 
                    text_color="#F8FAFC",
                    marker_color_circle=m_color
                )

    def on_treeview_select(self, event):
        selection = self.tree_vehicles.selection()
        if not selection:
            return
        
        vid = selection[0]
        self.selected_vehicle_id = vid
        
        self.lbl_panel_title.configure(text=f"MONITOREO DE PARÁMETROS UNITARIOS: CAMIÓN {self.selected_vehicle_id}")
        
        vdata = self.vehicles[vid]
        self.fuel_var.set(vdata["fuel"])
        self.capacity_var.set(vdata["capacity"])
        self.speed_var.set(vdata["speed"])
        self.status_var.set(vdata["status"])
        self.location_var.set(vdata["location"])
        
        self.lbl_fuel_val.configure(text=f"{vdata['fuel']:.1f}%")
        self.lbl_cap_val.configure(text=f"{vdata['capacity']:.1f}%")
        self.lbl_speed_val.configure(text=f"{vdata['speed']:.1f} km/h")
        self.cb_status.set(vdata["status"])
        self.cb_location.set(vdata["location"])
        
        # Center map camera on this vehicle
        self.map_widget.set_position(vdata["lat"], vdata["lng"])
        
        # Redraw the route path for this specific vehicle
        if hasattr(self, "map_path") and self.map_path:
            self.map_path.delete()
        self.map_path = self.map_widget.set_path(vdata["route_path"], color=self.accent_blue, width=3)
        
        # Update route status label text
        if vdata.get("is_custom", False):
            self.lbl_route_status.configure(
                text=f"Ruta {vid}: PERSONALIZADA ({len(vdata['route_path'])} puntos)",
                foreground=self.accent_green
            )
        else:
            if vid == "T-101":
                route_name = "AREQUIPA CERCADO (Predet. T-101)"
            elif vid == "T-102":
                route_name = "YANAHUARA NORTE (Predet. T-102)"
            elif vid == "T-103":
                route_name = "CERCADO SUR (Predet. T-103)"
            else:
                route_name = "AREQUIPA CERCADO (Predet.)"
            self.lbl_route_status.configure(
                text=f"Ruta activa: {route_name}",
                foreground=self.text_muted
            )

        self.write_log("ROUTE", f"Enfoque táctico centrado en la unidad {vid} - Coordenadas ({vdata['lat']:.5f}, {vdata['lng']:.5f})")

    def add_new_vehicle(self):
        vid = self.ent_add_id.get().strip().upper()
        driver = self.ent_add_driver.get().strip()
        
        if not vid or not driver:
            messagebox.showerror("Campos vacíos", "Por favor ingresa un ID de vehículo y un nombre de chofer.")
            return
            
        if vid in self.vehicles:
            messagebox.showerror("Camión duplicado", f"El vehículo {vid} ya está en la simulación.")
            return
            
        # Choose a random default coordinate template
        route_template = random.choice([self.default_coords_t101, self.default_coords_t102, self.default_coords_t103])
        
        def make_path(c_list):
            p = []
            for idx in range(len(c_list) - 1):
                p.extend(interpolate_coordinates(c_list[idx], c_list[idx+1], steps=15))
            p.append(c_list[-1])
            return p
            
        new_path = make_path(route_template)
        start_progress = random.randint(0, len(new_path) - 1)
        lat, lng = new_path[start_progress]
        
        self.vehicles[vid] = {
            "plate": f"SIM-{random.randint(1000, 9999)}",
            "driver": driver,
            "status": "Available",
            "fuel": 100.0,
            "capacity": 0.0,
            "location": f"Base Central ({lat:.6f}, {lng:.6f})",
            "route_progress": start_progress,
            "lat": lat,
            "lng": lng,
            "speed": 0.0,
            "route_path": new_path,
            "is_custom": False
        }
        
        self.update_treeview()
        self.update_map_markers()
        self.update_global_stats()
        
        self.write_log("SYSTEM", f"Nueva unidad registrada: {vid} asignada a {driver}. Coordinando inyección...")
        
        self.ent_add_id.delete(0, tk.END)
        self.ent_add_driver.delete(0, tk.END)

    def remove_selected_vehicle(self):
        selection = self.tree_vehicles.selection()
        if not selection:
            messagebox.showwarning("Selección vacía", "Por favor selecciona un camión de la grilla para quitar.")
            return
            
        vid = selection[0]
        
        if len(self.vehicles) <= 1:
            messagebox.showerror("Mínimo requerido", "El sistema central exige al menos una unidad activa en monitoreo.")
            return
            
        if messagebox.askyesno("Confirmar retiro", f"¿Dar de baja y retirar de la inyección al vehículo {vid}?"):
            # Remove map marker
            if vid in self.markers:
                self.markers[vid].delete()
                del self.markers[vid]
                
            del self.vehicles[vid]
            
            if self.selected_vehicle_id == vid:
                self.selected_vehicle_id = list(self.vehicles.keys())[0]
                
            self.update_treeview()
            self.on_treeview_select(None)
            self.update_global_stats()
            self.write_log("SYSTEM", f"Unidad {vid} retirada del sistema de inyección telemétrica.")

    def update_speed_label(self, val):
        self.lbl_speed_val.configure(text=f"{float(val):.1f} km/h")
        self.vehicles[self.selected_vehicle_id]["speed"] = float(val)
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_treeview()
        self.update_global_stats()

    def update_fuel_label(self, val):
        self.lbl_fuel_val.configure(text=f"{float(val):.1f}%")
        self.vehicles[self.selected_vehicle_id]["fuel"] = float(val)
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_treeview()
        self.update_global_stats()

    def update_cap_label(self, val):
        self.lbl_cap_val.configure(text=f"{float(val):.1f}%")
        self.vehicles[self.selected_vehicle_id]["capacity"] = float(val)
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_treeview()
        self.update_global_stats()

    def on_status_change(self, event):
        self.vehicles[self.selected_vehicle_id]["status"] = self.status_var.get()
        self.update_map_markers()
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_treeview()
        self.update_global_stats()

    def on_location_change(self, event):
        loc = self.location_var.get()
        self.vehicles[self.selected_vehicle_id]["location"] = loc
        
        # If manual selection matches preset locations
        if loc in LOCATIONS:
            idx = LOCATIONS.index(loc)
            keypoint_progress = idx * 15
            if keypoint_progress < len(self.full_route_path):
                self.vehicles[self.selected_vehicle_id]["route_progress"] = keypoint_progress
                lat, lng = self.full_route_path[keypoint_progress]
                self.vehicles[self.selected_vehicle_id]["lat"] = lat
                self.vehicles[self.selected_vehicle_id]["lng"] = lng
                self.update_map_markers()
                self.map_widget.set_position(lat, lng)
                
        self.publish_vehicle_state(self.selected_vehicle_id)
        self.update_treeview()

    def toggle_auto_mode(self):
        if self.auto_mode.get():
            self.write_log("SYSTEM", "Simulador en modo automático. Trazado cíclico activo para toda la flota.")
            if self.is_connected:
                self.start_auto_simulation()
        else:
            self.write_log("SYSTEM", "Simulador en modo de parametrización manual mediante potenciómetros físicos.")
            if self.auto_timer_id:
                self.root.after_cancel(self.auto_timer_id)
                self.auto_timer_id = None

    def set_controls_state(self, state_str):
        state_val = tk.DISABLED if state_str == "disabled" else tk.NORMAL
        self.scale_speed.configure(state=state_val)
        self.scale_fuel.configure(state=state_val)
        self.scale_cap.configure(state=state_val)
        self.cb_status.configure(state="disabled" if state_str == "disabled" else "readonly")
        self.cb_location.configure(state=state_str)
        self.btn_add.configure(state=state_val)
        self.btn_remove.configure(state=state_val)
        self.btn_design_route.configure(state=state_val)
        self.btn_clear_draft.configure(state=state_val)
        self.btn_restore_default.configure(state=state_val)
        if state_str == "disabled":
            self.btn_apply_route.configure(state=tk.DISABLED)
        elif self.is_editing_route and len(self.custom_route_waypoints) >= 2:
            self.btn_apply_route.configure(state=tk.NORMAL)

    def write_log(self, category, message):
        """Writes a stylized corporate log with distinct category highlights"""
        timestamp = time.strftime("%H:%M:%S")
        self.txt_logs.configure(state=tk.NORMAL)
        
        # Muted gray timestamp
        self.txt_logs.insert(tk.END, f"[{timestamp}] ", "time")
        
        # Map category to specific styles
        cat_upper = category.upper()
        tag = "default"
        prefix = ""
        
        if "SYSTEM" in cat_upper:
            tag = "system"
            prefix = "[SISTEMA] "
        elif "SEND" in cat_upper or "ENVIADO" in cat_upper:
            tag = "sent"
            prefix = "[ENVIADO] "
        elif "OK" in cat_upper or "CONN" in cat_upper or "MQTT" in cat_upper:
            tag = "mqtt"
            prefix = "[RED MQTT] "
        elif "ROUTE" in cat_upper or "RUTA" in cat_upper:
            tag = "route"
            prefix = "[TRAYECTORIA] "
        elif "ERROR" in cat_upper:
            tag = "error"
            prefix = "[ALERTA] "
            
        self.txt_logs.insert(tk.END, prefix, tag)
        self.txt_logs.insert(tk.END, f"{message}\n")
        self.txt_logs.see(tk.END)
        self.txt_logs.configure(state=tk.DISABLED)

    def toggle_connection(self):
        if not self.is_connected:
            self.connect_mqtt()
        else:
            self.disconnect_mqtt()

    def connect_mqtt(self):
        broker = self.ent_broker.get().strip()
        port_str = self.ent_port.get().strip()
        
        if not broker or not port_str:
            messagebox.showerror("Campos vacíos", "Por favor ingresa Broker IP y Puerto.")
            return
            
        try:
            port = int(port_str)
        except ValueError:
            messagebox.showerror("Puerto inválido", "El puerto debe ser un número entero.")
            return

        self.write_log("MQTT", f"Estableciendo enlace de red con mqtt://{broker}:{port}...")
        self.mqtt_client = mqtt.Client(client_id=f"scada_gis_sim_{random.randint(100, 999)}")
        
        try:
            self.mqtt_client.connect(broker, port, keepalive=60)
            self.mqtt_client.loop_start()
            
            self.is_connected = True
            self.btn_connect.configure(text="🛑 DESCONECTAR ENLACE SCADA", bg=self.accent_red)
            
            self.canvas_led.itemconfig(self.led_oval, fill=self.accent_green)
            self.lbl_transmission_state.configure(text="SISTEMA ONLINE", foreground=self.accent_green)
            self.lbl_mqtt_status.configure(text="Excelente", fg=self.accent_green)
            
            self.write_log("MQTT", f"Enlace establecido con el Broker. Inicializando simulación telemétrica...")
            self.set_controls_state("normal")
            
            self.ent_broker.configure(state=tk.DISABLED)
            self.ent_port.configure(state=tk.DISABLED)
            
            if self.auto_mode.get():
                self.start_auto_simulation()
            else:
                for vid in self.vehicles.keys():
                    self.publish_vehicle_state(vid)
                
        except Exception as e:
            self.write_log("ERROR", f"Fallo al conectar con el Broker: {e}")
            messagebox.showerror("Fallo de Enlace", f"No se pudo establecer conexión con el Broker MQTT:\n{e}")
            self.disconnect_mqtt()

    def disconnect_mqtt(self):
        if self.auto_timer_id:
            self.root.after_cancel(self.auto_timer_id)
            self.auto_timer_id = None
            
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            self.mqtt_client = None
            
        self.is_connected = False
        self.btn_connect.configure(text="🔌 CONECTAR Y TRANSMITIR", bg="#1E293B")
        
        self.canvas_led.itemconfig(self.led_oval, fill="#8899b4")
        self.lbl_transmission_state.configure(text="DESCONECTADO", foreground="#8899b4")
        self.lbl_mqtt_status.configure(text="Desconectado", fg=self.accent_red)
        
        self.write_log("MQTT", "Enlace telemétrico cerrado. Transmisión inactiva.")
        self.set_controls_state("disabled")
        
        self.ent_broker.configure(state=tk.NORMAL)
        self.ent_port.configure(state=tk.NORMAL)

    def publish_vehicle_state(self, vid):
        if not self.is_connected or not self.mqtt_client:
            return
            
        vdata = self.vehicles[vid]
        payload = {
            "fuel": round(vdata["fuel"], 1),
            "capacity": round(vdata["capacity"], 1),
            "location": vdata["location"],
            "speed": round(vdata["speed"], 1),
            "status": vdata["status"],
            "driver": vdata["driver"]
        }
        
        topic = f"fleet/{vid}/telemetry"
        payload_str = json.dumps(payload)
        
        try:
            self.mqtt_client.publish(topic, payload_str, qos=1)
            
            # Keep logs clean from flooding, slice top lines if very large
            log_size = float(self.txt_logs.index('end-1c'))
            if log_size > 150:
                self.txt_logs.configure(state=tk.NORMAL)
                self.txt_logs.delete("1.0", "3.0")
                self.txt_logs.configure(state=tk.DISABLED)
                
            self.msg_counter += 1
            self.lbl_mqtt_counter.configure(text=str(self.msg_counter))
            self.lbl_mqtt_rate.configure(text=f"{len(self.vehicles)} / 3.0s (~{len(self.vehicles)/3.0:.2f} Hz)")
            
            self.write_log("SEND", f"{vid} telemetry payload -> {payload_str}")
        except Exception as e:
            self.write_log("ERROR", f"Error al emitir telemetría de {vid}: {e}")

    def start_auto_simulation(self):
        if not self.is_connected:
            return
            
        def sim_step():
            if not self.is_connected:
                return
                
            for vid, vdata in list(self.vehicles.items()):
                fuel = vdata["fuel"]
                capacity = vdata["capacity"]
                speed = vdata["speed"]
                status = vdata["status"]
                progress = vdata.get("route_progress", 0)
                
                # Intelligent dynamic SCADA states shifts
                if status == "Available":
                    speed = 0.0
                    if random.random() > 0.4:
                        status = "In Route"
                elif status == "In Route":
                    speed_delta = random.uniform(-12.0, 12.0)
                    speed = max(20.0, min(90.0, speed + speed_delta))
                    capacity = min(100.0, capacity + random.uniform(1.5, 6.0))
                    fuel = max(0.0, fuel - random.uniform(0.3, 0.8))
                    
                    if fuel < 20.0:
                        status = "Low Fuel"
                    if capacity >= 95.0:
                        status = "Maintenance"
                elif status == "Low Fuel":
                    speed = max(10.0, speed - 8.0)
                    fuel = max(0.0, fuel - random.uniform(0.1, 0.4))
                    if random.random() > 0.85:
                        fuel = 100.0
                        status = "In Route"
                elif status == "Maintenance":
                    speed = 0.0
                    if random.random() > 0.75:
                        capacity = 0.0
                        status = "Available"

                # Advance geographic loop progress if truck has speed
                r_path = vdata["route_path"]
                if progress >= len(r_path):
                    progress = 0
                if speed > 0:
                    progress = (progress + 1) % len(r_path)
                    
                lat, lng = r_path[progress]
                vdata["lat"] = lat
                vdata["lng"] = lng
                vdata["route_progress"] = progress
                
                # Dynamic geozoning sector resolution
                if vdata.get("is_custom", False):
                    c_wps = vdata.get("custom_waypoints", [])
                    if len(c_wps) > 0:
                        waypoint_idx = int((progress / len(r_path)) * len(c_wps))
                        waypoint_idx = min(waypoint_idx, len(c_wps) - 1)
                        sector = f"Sector Pers. - Nodo {waypoint_idx + 1}"
                    else:
                        sector = "Trayecto Especial"
                else:
                    sector = "Cercado Arequipa"
                    if progress < 15:
                        sector = "Base Central"
                    elif progress < 30:
                        sector = "Plaza de Armas"
                    elif progress < 45:
                        sector = "Calle Mercaderes"
                    elif progress < 60:
                        sector = "Av. Ejército"
                    elif progress < 75:
                        sector = "Mirador Yanahuara"
                    elif progress < 90:
                        sector = "Taller Norte"
                    else:
                        sector = "Estación Servicio"
                    
                vdata["location"] = f"{sector} ({lat:.6f}, {lng:.6f})"
                
                # Apply simulated numbers to internal state db
                vdata["fuel"] = fuel
                vdata["capacity"] = capacity
                vdata["speed"] = speed
                vdata["status"] = status
                
                # Sync control inputs live only if currently selected
                if vid == self.selected_vehicle_id:
                    self.fuel_var.set(fuel)
                    self.capacity_var.set(capacity)
                    self.speed_var.set(speed)
                    self.status_var.set(status)
                    self.location_var.set(vdata["location"])
                    
                    self.lbl_fuel_val.configure(text=f"{fuel:.1f}%")
                    self.lbl_cap_val.configure(text=f"{capacity:.1f}%")
                    self.lbl_speed_val.configure(text=f"{speed:.1f} km/h")
                    self.cb_status.set(status)
                    self.cb_location.set(vdata["location"])
                
                # Publish live payload
                self.publish_vehicle_state(vid)
                
            # Render grid updates and aggregate statistics in real-time
            self.update_treeview()
            self.update_map_markers()
            self.update_global_stats()
            
            # Pulse communication LED blue then green
            self.canvas_led.itemconfig(self.led_oval, fill=self.accent_blue)
            self.root.after(350, lambda: self.canvas_led.itemconfig(self.led_oval, fill=self.accent_green))
            
            # Schedule next simulation tick in 3 seconds
            self.auto_timer_id = self.root.after(3000, sim_step)

        sim_step()

if __name__ == "__main__":
    root = tk.Tk()
    app = FleetSimulatorGUI(root)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("\nSCADA offline.")
