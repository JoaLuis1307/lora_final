#include "node_config_service.h"
#include "../../config.h"
#include "../drivers/lora_driver.h"
#include "../drivers/mq135_driver.h"
#include "../drivers/ultrasonic_driver.h"
#include "../drivers/ir_driver.h"
#include "../drivers/tof_driver.h"
#include "../drivers/gps_driver.h"
#include "../drivers/ina219_driver.h"
#include "sensor_service.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>

static WebServer server(NODE_WEB_PORT);
static DNSServer dns_server;
static Preferences cfg_prefs;
static bool ap_active = false;

static char cfg_node_id[32] = NODE_ID;
static int cfg_send_interval = SEND_INTERVAL;
static int cfg_lora_freq = (int)(LORA_FREQ / 1000000);
static int cfg_deep_sleep = DEEP_SLEEP_ENABLE;
static uint8_t cfg_sensor_mask = DEFAULT_SENSOR_MASK;

// ===================== HTML DASHBOARD =====================

static const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nodo IoT - Administracion</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--navy:#1b2a4a;--navy-l:#243656;--blue:#049fd9;--blue-d:#038ab8;--green:#0d904f;--red:#cb2938;--orange:#e87500;--bg:#eef1f5;--card:#fff;--border:#d4d8dd;--txt:#24292e;--muted:#6a737d;--hover:#f6f8fa}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;font-size:14px;line-height:1.5}
.topbar{background:var(--navy);color:#fff;height:48px;display:flex;align-items:center;padding:0 20px;position:fixed;top:0;left:0;right:0;z-index:200}
.topbar .logo{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700}
.topbar .logo svg{width:28px;height:28px}
.topbar .sep{width:1px;height:24px;background:rgba(255,255,255,.2);margin:0 16px}
.topbar .model{font-size:12px;color:rgba(255,255,255,.6)}
.topbar .badge{margin-left:auto;font-size:11px;padding:3px 10px;border-radius:3px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;background:rgba(13,144,79,.2);color:#4cd964;border:1px solid rgba(13,144,79,.3)}
.sidebar{position:fixed;top:48px;left:0;bottom:0;width:200px;background:var(--navy-l);border-right:1px solid rgba(255,255,255,.08);z-index:100;overflow-y:auto}
.sidebar nav a{display:flex;align-items:center;gap:10px;padding:10px 16px;color:rgba(255,255,255,.55);text-decoration:none;font-size:13px;font-weight:500;border-left:2px solid transparent;transition:all .15s;cursor:pointer}
.sidebar nav a:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.9)}
.sidebar nav a.on{background:rgba(4,159,217,.12);color:#fff;border-left-color:var(--blue)}
.sidebar nav a svg{width:16px;height:16px;opacity:.7;flex-shrink:0}
.sidebar nav a.on svg{opacity:1}
.main{margin-left:200px;margin-top:48px;min-height:calc(100vh - 48px)}
.breadcrumb{padding:12px 24px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border);background:#fff}
.breadcrumb b{color:var(--txt);font-weight:600}
.content{padding:20px 24px;max-width:1100px}
.page{display:none}.page.on{display:block}
.card{background:var(--card);border:1px solid var(--border);margin-bottom:16px;border-radius:4px}
.card-head{padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;color:var(--navy);display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:.3px}
.card-head .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dot-g{background:var(--green)}.dot-r{background:var(--red)}.dot-y{background:var(--orange)}.dot-b{background:var(--blue)}
.card-body{padding:16px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;padding:8px 12px;background:#f6f8fa;border-bottom:2px solid var(--border);font-weight:600;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px}
.tbl td{padding:8px 12px;border-bottom:1px solid #eef0f3}
.tbl tr:last-child td{border-bottom:none}
.tbl .mono{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.status-item{padding:14px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;gap:12px}
.status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;border:2px solid}
.status-dot.ok{border-color:var(--green);background:rgba(13,144,79,.15)}
.status-dot.er{border-color:var(--red);background:rgba(203,41,56,.15)}
.status-dot.warn{border-color:var(--orange);background:rgba(232,117,0,.15)}
.status-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px}
.status-value{font-size:16px;font-weight:700;margin-top:1px}
.status-sub{font-size:11px;color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin:16px 0}
.stat{background:#fff;padding:12px;text-align:center}
.stat .val{font-size:18px;font-weight:700;color:var(--navy);font-family:'SF Mono',Monaco,Consolas,monospace}
.stat .lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:2px}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.fg input,.fg select{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:3px;font-size:13px;font-family:inherit;background:#fff}
.fg input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 2px rgba(4,159,217,.15)}
.fg .help{font-size:11px;color:var(--muted);margin-top:3px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.btn{padding:7px 16px;border:1px solid transparent;border-radius:3px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.3px}
.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue-d)}.btn-primary:hover{background:var(--blue-d)}
.btn-danger{background:var(--red);color:#fff;border-color:#b0222f}.btn-danger:hover{background:#b0222f}
.btn-outline{background:transparent;color:var(--blue);border-color:var(--border)}.btn-outline:hover{background:#f0f7fb}
.btn-success{background:var(--green);color:#fff;border-color:#0a7a42}.btn-success:hover{background:#0a7a42}
.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.sensor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sensor-card{border:1px solid var(--border);border-radius:4px;overflow:hidden}
.sensor-head{padding:10px 14px;background:#f6f8fa;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.sensor-icon{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.sensor-icon.ok{background:var(--green)}.sensor-icon.er{background:var(--red)}.sensor-icon.off{background:#999}
.sensor-name{font-weight:600;font-size:12px;color:var(--navy)}
.sensor-body{padding:14px}
.sensor-val{font-size:22px;font-weight:700;font-family:'SF Mono',Monaco,Consolas,monospace;color:var(--navy)}
.sensor-unit{font-size:12px;color:var(--muted);font-weight:400}
.sensor-sub{font-size:11px;color:var(--muted);margin-top:4px}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eef0f3}
.toggle-row:last-child{border-bottom:none}
.toggle-label{font-size:13px;font-weight:600}
.toggle-sub{font-size:11px;color:var(--muted)}
.switch{position:relative;width:44px;height:24px;flex-shrink:0}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;transition:.3s;border-radius:24px}
.slider:before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background:#fff;transition:.3s;border-radius:50%}
input:checked+.slider{background:var(--green)}
input:checked+.slider:before{transform:translateX(20px)}
.empty{text-align:center;padding:40px;color:var(--muted)}
.menu-toggle{display:none;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;margin-right:12px}
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);width:220px;transition:transform .2s}.sidebar.open{transform:translateX(0)}
  .main{margin-left:0}.menu-toggle{display:block}
  .status-grid,.sensor-grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.row2,.row3{grid-template-columns:1fr}
  .content{padding:14px}
}
</style>
</head><body>

<div class="topbar">
<button class="menu-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">&#9776;</button>
<div class="logo">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
<span>IoT Node</span>
</div>
<div class="sep"></div>
<span class="model">ESP32 | LoRa 433MHz | Sensores</span>
<span class="badge" id="badge">AP MODE</span>
</div>

<div class="sidebar" id="sidebar">
<nav id="nv">
<a class="on" data-p="panel" onclick="go('panel')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
Panel</a>
<a data-p="sensores" onclick="go('sensores')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
Sensores</a>
<a data-p="lora" onclick="go('lora')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
LoRa</a>
<a data-p="config" onclick="go('config')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
Configuracion</a>
<a data-p="tools" onclick="go('tools')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
Herramientas</a>
</nav>
</div>

<div class="main">
<div class="breadcrumb">Nodo IoT &rsaquo; <b id="pt">Panel de Control</b></div>
<div class="content">

<!-- PANEL -->
<div id="panel" class="page on">
<div class="status-grid">
<div class="status-item"><div class="status-dot" id="ldot"></div><div><div class="status-label">Radio LoRa</div><div class="status-value" id="vl">--</div><div class="status-sub" id="tl">--</div></div></div>
<div class="status-item"><div class="status-dot" id="sdot"></div><div><div class="status-label">Sensores</div><div class="status-value" id="vs">--</div><div class="status-sub" id="ts">--</div></div></div>
<div class="status-item"><div class="status-dot" id="ddot"></div><div><div class="status-label">Deep Sleep</div><div class="status-value" id="vd">--</div><div class="status-sub" id="td">--</div></div></div>
</div>
<div class="stats">
<div class="stat"><div class="val" id="vu">--</div><div class="lbl">Uptime</div></div>
<div class="stat"><div class="val" id="vh">--</div><div class="lbl">Memoria</div></div>
<div class="stat"><div class="val" id="vt">--</div><div class="lbl">Bateria</div></div>
<div class="stat"><div class="val" id="vu2">--</div><div class="lbl">SOC</div></div>
</div>
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Informacion del Sistema</div><div class="card-body">
<table class="tbl">
<tr><td style="width:40%">Node ID</td><td class="mono" id="vid">--</td></tr>
<tr><td>Direccion IP</td><td class="mono">192.168.4.1</td></tr>
<tr><td>Frecuencia LoRa</td><td class="mono" id="vlf">--</td></tr>
<tr><td>Intervalo de envio</td><td id="vsi">--</td></tr>
<tr><td>Sensores activos</td><td id="vsa">--</td></tr>
</table>
</div></div>
</div>

<!-- SENSORES -->
<div id="sensores" class="page">
<div class="card"><div class="card-head"><span class="dot dot-g"></span>Lectura en Tiempo Real</div><div class="card-body">
<div class="sensor-grid">
<div class="sensor-card" style="grid-column:span 2"><div class="sensor-head"><div class="sensor-icon" id="s_bat_icon">B</div><div class="sensor-name">INA219 Bateria 18650 (1600mAh)</div></div><div class="sensor-body">
<div style="display:flex;align-items:center;gap:20px;margin-bottom:10px">
<div style="flex:0 0 auto;text-align:center"><div style="font-size:40px;font-weight:800;font-family:monospace;color:var(--navy)" id="s_bat_soc">--%</div><div class="sensor-sub">Carga</div></div>
<div style="flex:1"><div style="background:#e9ecef;border-radius:6px;height:20px;overflow:hidden"><div id="s_bat_bar" style="height:100%;width:0%;background:var(--green);transition:width .5s,background .5s;border-radius:6px"></div></div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
<div><div class="sensor-sub">Voltaje</div><div style="font-size:18px;font-weight:700;font-family:monospace" id="s_bat_v">-- <span class="sensor-unit">V</span></div></div>
<div><div class="sensor-sub">Corriente</div><div style="font-size:18px;font-weight:700;font-family:monospace" id="s_bat_c">-- <span class="sensor-unit">mA</span></div></div>
<div><div class="sensor-sub">Potencia</div><div style="font-size:18px;font-weight:700;font-family:monospace" id="s_bat_p">-- <span class="sensor-unit">mW</span></div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;border-top:1px solid var(--border);padding-top:8px">
<div><div class="sensor-sub">Restante</div><div style="font-size:14px;font-weight:600;font-family:monospace" id="s_bat_rem">-- <span class="sensor-unit">mAh</span></div></div>
<div><div class="sensor-sub">Consumido</div><div style="font-size:14px;font-weight:600;font-family:monospace" id="s_bat_cons">-- <span class="sensor-unit">mAh</span></div></div>
<div><div class="sensor-sub">Autonomia</div><div style="font-size:14px;font-weight:600;font-family:monospace" id="s_bat_run">-- <span class="sensor-unit">min</span></div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;border-top:1px solid var(--border);padding-top:8px">
<div><div class="sensor-sub">Energia rest.</div><div style="font-size:13px;font-weight:600;font-family:monospace" id="s_bat_ew">-- <span class="sensor-unit">mWh</span></div></div>
<div><div class="sensor-sub">Energia total</div><div style="font-size:13px;font-weight:600;font-family:monospace" id="s_bat_et">-- <span class="sensor-unit">mWh</span></div></div>
<div><div class="sensor-sub">Energia cons.</div><div style="font-size:13px;font-weight:600;font-family:monospace" id="s_bat_ec">-- <span class="sensor-unit">mWh</span></div></div>
</div>
</div></div>
<div class="sensor-card"><div class="sensor-head"><div class="sensor-icon" id="s_mq_icon">M</div><div class="sensor-name">MQ135</div></div><div class="sensor-body"><div class="sensor-val" id="s_aq">--<span class="sensor-unit"> raw</span></div><div class="sensor-sub">Calidad del aire</div></div></div>
<div class="sensor-card"><div class="sensor-head"><div class="sensor-icon" id="s_ultra_icon">U</div><div class="sensor-name">HC-SR04</div></div><div class="sensor-body"><div class="sensor-val" id="s_dist">--<span class="sensor-unit"> cm</span></div><div class="sensor-sub">Ultrasonido</div></div></div>
<div class="sensor-card"><div class="sensor-head"><div class="sensor-icon" id="s_ir_icon">I</div><div class="sensor-name">HW-201 IR</div></div><div class="sensor-body"><div class="sensor-val" id="s_ir">--</div><div class="sensor-sub">Infrarrojo</div></div></div>
<div class="sensor-card"><div class="sensor-head"><div class="sensor-icon" id="s_tof_icon">T</div><div class="sensor-name">VL53L0X</div></div><div class="sensor-body"><div class="sensor-val" id="s_tof">--<span class="sensor-unit"> cm</span></div><div class="sensor-sub">Time of Flight</div></div></div>
<div class="sensor-card"><div class="sensor-head"><div class="sensor-icon" id="s_gps_icon">G</div><div class="sensor-name">NEO-6M GPS</div></div><div class="sensor-body"><div class="sensor-val" id="s_gps_lat">--</div><div class="sensor-sub">Lon: <span id="s_gps_lon">--</span><br>Sats: <span id="s_gps_sats">--</span></div></div></div>
</div>
</div></div>
<div class="card"><div class="card-head">Estado de Salud</div><div class="card-body">
<table class="tbl"><thead><tr><th>Sensor</th><th>Salud</th><th>Habilitado</th><th>Pin</th></tr></thead><tbody>
<tr><td>INA219</td><td id="sh0">--</td><td id="se0">--</td><td class="mono">I2C 0x40</td></tr>
<tr><td>MQ135</td><td id="sh1">--</td><td id="se1">--</td><td class="mono">GPIO 34</td></tr>
<tr><td>HC-SR04</td><td id="sh2">--</td><td id="se2">--</td><td class="mono">GPIO 32/33</td></tr>
<tr><td>HW-201 IR</td><td id="sh3">--</td><td id="se3">--</td><td class="mono">GPIO 26</td></tr>
<tr><td>VL53L0X</td><td id="sh4">--</td><td id="se4">--</td><td class="mono">I2C 21/22</td></tr>
<tr><td>NEO-6M GPS</td><td id="sh5">--</td><td id="se5">--</td><td class="mono">Serial2 16/17</td></tr>
</tbody></table>
</div></div>
</div>

<!-- LORA -->
<div id="lora" class="page">
<div class="card"><div class="card-head"><span class="dot dot-g" id="ldot2"></span>Monitor de Senal en Tiempo Real</div><div class="card-body">
<div class="row3">
<div><div class="status-label">RSSI</div><div style="font-size:24px;font-weight:700;font-family:monospace;color:var(--navy)" id="lr_rssi">--</div><div class="status-sub">dBm (potencia recibida)</div></div>
<div><div class="status-label">SNR</div><div style="font-size:24px;font-weight:700;font-family:monospace;color:var(--navy)" id="lr_snr">--</div><div class="status-sub">dB (senal vs ruido)</div></div>
<div><div class="status-label">Calidad</div><div style="font-size:20px;font-weight:700" id="lr_qual">--</div><div class="status-sub" id="lr_qual_sub">Esperando datos...</div></div>
</div>
<div style="margin-top:14px">
<div class="status-label" style="margin-bottom:6px">Nivel de Senal</div>
<div style="background:#e9ecef;border-radius:4px;height:24px;overflow:hidden;position:relative">
<div id="lr_bar" style="height:100%;width:0%;background:var(--red);transition:width .5s,background .5s;border-radius:4px"></div>
<div id="lr_bar_text" style="position:absolute;top:0;left:0;right:0;text-align:center;font-size:11px;font-weight:700;line-height:24px;color:#fff">--</div>
</div>
</div>
<div class="row3" style="margin-top:14px">
<div><div class="status-label">Ruido Fondo</div><div style="font-size:16px;font-weight:700;font-family:monospace" id="lr_noise">--</div><div class="status-sub">dBm estimado</div></div>
<div><div class="status-label">Enviados (TX)</div><div style="font-size:16px;font-weight:700;font-family:monospace" id="lr_tx">--</div><div class="status-sub">paquetes</div></div>
<div><div class="status-label">Recibidos (RX)</div><div style="font-size:16px;font-weight:700;font-family:monospace" id="lr_rx">--</div><div class="status-sub">paquetes</div></div>
</div>
</div></div>
<div class="card"><div class="card-head"><span class="dot dot-g" id="ldot2b"></span>Estado del Enlace LoRa</div><div class="card-body">
<div class="row3">
<div><div class="status-label">Frecuencia</div><div style="font-size:18px;font-weight:700;font-family:monospace" id="lf">433 MHz</div></div>
<div><div class="status-label">Estado</div><div style="font-size:18px;font-weight:700" id="ls">--</div></div>
<div><div class="status-label">SPI</div><div style="font-size:14px;font-weight:600;font-family:monospace">SCK:18 MISO:19 MOSI:23</div></div>
</div>
</div></div>
<div class="card"><div class="card-head">Configuracion Hardware LoRa</div><div class="card-body">
<table class="tbl">
<tr><td style="width:40%">Frecuencia</td><td class="mono" id="lf2">433 MHz</td></tr>
<tr><td>CS Pin</td><td class="mono">GPIO 5</td></tr>
<tr><td>RST Pin</td><td class="mono">GPIO 14</td></tr>
<tr><td>IRQ Pin</td><td class="mono">GPIO 27</td></tr>
<tr><td>Protocolo</td><td>LoRa CSS</td></tr>
<tr><td>BW / SF / CR</td><td class="mono">125kHz / 7 / 4/5</td></tr>
<tr><td>Potencia TX</td><td class="mono">20 dBm</td></tr>
</table>
</div></div>
<div class="card"><div class="card-head">Frecuencia de Operacion</div><div class="card-body">
<div class="fg"><label>Frecuencia (MHz)</label><input id="clf" type="number" placeholder="433"><div class="help">Debe coincidir con la frecuencia del gateway</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveLora()">Aplicar</button></div>
</div></div>
</div>

<!-- CONFIGURACION -->
<div id="config" class="page">
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Identificacion</div><div class="card-body">
<div class="fg"><label>Node ID</label><input id="cnid" placeholder="node_01"><div class="help">Identificador unico del nodo en la red LoRa</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveId()">Guardar</button></div>
</div></div>

<div class="card"><div class="card-head"><span class="dot dot-y"></span>Envio de Datos</div><div class="card-body">
<div class="fg"><label>Intervalo de envio (ms)</label><input id="csi" type="number" placeholder="30000"><div class="help">Tiempo entre envios LoRa al gateway (minimo 5000ms)</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveInterval()">Guardar</button></div>
</div></div>

<div class="card"><div class="card-head"><span class="dot dot-g"></span>Sensores - Habilitar / Deshabilitar</div><div class="card-body">
<p style="font-size:12px;color:var(--muted);margin-bottom:14px">Active o desactive sensores individualmente para ahorrar energia o adaptar las lecturas.</p>
<div class="toggle-row"><div><div class="toggle-label">INA219 (Bateria)</div><div class="toggle-sub">I2C 0x40</div></div><label class="switch"><input type="checkbox" id="sw0" onchange="toggleSensor(0,this.checked)"><span class="slider"></span></label></div>
<div class="toggle-row"><div><div class="toggle-label">MQ135 (Calidad del Aire)</div><div class="toggle-sub">GPIO 34 (ADC)</div></div><label class="switch"><input type="checkbox" id="sw1" onchange="toggleSensor(1,this.checked)"><span class="slider"></span></label></div>
<div class="toggle-row"><div><div class="toggle-label">HC-SR04 (Ultrasonido)</div><div class="toggle-sub">GPIO 32/33</div></div><label class="switch"><input type="checkbox" id="sw2" onchange="toggleSensor(2,this.checked)"><span class="slider"></span></label></div>
<div class="toggle-row"><div><div class="toggle-label">HW-201 (Infrarrojo)</div><div class="toggle-sub">GPIO 26</div></div><label class="switch"><input type="checkbox" id="sw3" onchange="toggleSensor(3,this.checked)"><span class="slider"></span></label></div>
<div class="toggle-row"><div><div class="toggle-label">VL53L0X (Time of Flight)</div><div class="toggle-sub">I2C GPIO 21/22</div></div><label class="switch"><input type="checkbox" id="sw4" onchange="toggleSensor(4,this.checked)"><span class="slider"></span></label></div>
<div class="toggle-row"><div><div class="toggle-label">NEO-6M (GPS)</div><div class="toggle-sub">Serial2 GPIO 16/17</div></div><label class="switch"><input type="checkbox" id="sw5" onchange="toggleSensor(5,this.checked)"><span class="slider"></span></label></div>
</div></div>

<div class="card"><div class="card-head"><span class="dot dot-y"></span>Deep Sleep</div><div class="card-body">
<div class="fg"><label>Modo</label>
<select id="cds"><option value="0">Desactivado - Siempre activo</option><option value="1">Activado - Ahorro de energia</option></select>
<div class="help">En deep sleep el nodo duerme entre envios. Despierta por timer o boton.</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveDs()">Guardar</button></div>
</div></div>
</div>

<!-- HERRAMIENTAS -->
<div id="tools" class="page">
<div class="card"><div class="card-head"><span class="dot dot-y"></span>Mantenimiento</div><div class="card-body">
<div class="actions">
<button class="btn btn-primary" onclick="doReboot()">Reiniciar Nodo</button>
<button class="btn btn-danger" onclick="doReset()">Restablecer Fabrica</button>
<button class="btn btn-outline" onclick="doExitAP()">Salir del Modo AP</button>
</div>
</div></div>
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Firmware</div><div class="card-body">
<table class="tbl">
<tr><td style="width:40%">Version</td><td class="mono">2.0</td></tr>
<tr><td>Placa</td><td>ESP32</td></tr>
<tr><td>Memoria</td><td class="mono" id="th">--</td></tr>
<tr><td>Uptime</td><td id="tu">--</td></tr>
<tr><td>LoRa</td><td class="mono" id="tf">433 MHz</td></tr>
<tr><td>Sensores habilitados</td><td id="tsa">--</td></tr>
</table>
</div></div>
</div>

</div>
</div>

<script>
var $=id=>document.getElementById(id);
var T={panel:'Panel de Control',sensores:'Sensores',lora:'LoRa / Radio',config:'Configuracion',tools:'Herramientas'};
function go(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));document.querySelectorAll('#nv a').forEach(x=>x.classList.remove('on'));$(p).classList.add('on');document.querySelector('[data-p="'+p+'"]').classList.add('on');$('pt').textContent=T[p]||p;$('sidebar').classList.remove('open')}
function fmt(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m '+s%60+'s';return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m'}
function upd(d){
var l=d.lora_ready;
$('badge').textContent='AP MODE';$('badge').className='badge';
$('vl').textContent=l?'Online':'Offline';$('ldot').className='status-dot '+(l?'ok':'er');
$('tl').textContent=(d.lora_freq||433)+' MHz';
var sc=d.sensors_ok||0;$('vs').textContent=sc+'/6';$('ts').textContent=d.sensors_enabled+'/6 habilitados';
$('sdot').className='status-dot '+(sc>=4?'ok':sc>=2?'warn':'er');
$('vd').textContent=d.deep_sleep?'Act':'Des';$('td').textContent=d.deep_sleep?'Ahorro energia':'Siempre activo';
$('ddot').className='status-dot '+(d.deep_sleep?'ok':'warn');
$('vu').textContent=fmt(d.uptime||0);$('vh').textContent=d.heap?Math.round(d.heap/1024)+'K':'--';
$('vt').textContent=d.batt_voltage!=null?d.batt_voltage.toFixed(2)+'V':'--';
$('vu2').textContent=d.batt_soc_percent!=null?d.batt_soc_percent.toFixed(1)+'%':'--';
if(d.batt_critical){$('vu2').style.color='var(--red)';$('vt').style.color='var(--red)';}
else if(d.batt_low){$('vu2').style.color='#d97706';$('vt').style.color='#d97706';}
else{$('vu2').style.color='';$('vt').style.color='';}
$('vid').textContent=d.node_id||'--';
$('vlf').textContent=(d.lora_freq||433)+' MHz';
$('vsi').textContent=(d.send_interval||30000)+'ms';
$('vsa').textContent=(d.sensors_ok||0)+' de 6';
$('lf').textContent=(d.lora_freq||433)+' MHz';$('ls').textContent=l?'Online':'Offline';
if($('ldot2'))$('ldot2').className='dot '+(l?'dot-g':'dot-r');
$('lf2').textContent=(d.lora_freq||433)+' MHz';
$('th').textContent=d.heap?Math.round(d.heap/1024)+'K':'--';$('tu').textContent=fmt(d.uptime||0);
$('tf').textContent=(d.lora_freq||433)+' MHz';
$('tsa').textContent=(d.sensors_enabled||0)+' de 6';
if(d.sensor_mask!=null){for(var i=0;i<6;i++){$('sw'+i).checked=!!(d.sensor_mask&(1<<i));}}
}
function upds(d){
if(!d)return;
function sv(id,v,u){$(id).innerHTML=v+(u?'<span class="sensor-unit"> '+u+'</span>':'');}
sv('s_bat_v',d.batt_voltage!=null?d.batt_voltage.toFixed(2):'--','V');
sv('s_bat_c',d.batt_current_ma!=null?d.batt_current_ma.toFixed(1):'--','mA');
sv('s_bat_p',d.batt_power_mw!=null?d.batt_power_mw.toFixed(0):'--','mW');
if(d.batt_soc_percent!=null){
var pct=d.batt_soc_percent;
$('s_bat_soc').textContent=pct.toFixed(1)+'%';
$('s_bat_soc').style.color=pct<10?'var(--red)':pct<20?'#d97706':'var(--navy)';
var bar=$('s_bat_bar');bar.style.width=pct+'%';
bar.style.background=pct<10?'var(--red)':pct<20?'#d97706':pct<50?'#eab308':'var(--green)';
sv('s_bat_rem',d.batt_remaining_mah!=null?d.batt_remaining_mah.toFixed(0):'--','mAh');
sv('s_bat_cons',d.batt_consumed_mah!=null?d.batt_consumed_mah.toFixed(1):'--','mAh');
sv('s_bat_run',d.batt_runtime_min!=null?(d.batt_runtime_min>999?'Inf':d.batt_runtime_min.toFixed(0)):'--','min');
sv('s_bat_ew',d.batt_energy_remaining_mwh!=null?d.batt_energy_remaining_mwh.toFixed(0):'--','mWh');
sv('s_bat_et',d.batt_energy_total_mwh!=null?d.batt_energy_total_mwh.toFixed(0):'--','mWh');
sv('s_bat_ec',d.batt_energy_consumed_mwh!=null?d.batt_energy_consumed_mwh.toFixed(1):'--','mWh');
}
sv('s_aq',d.air_quality!=null?d.air_quality:'--','raw');
sv('s_dist',d.ultrasonic_cm!=null?d.ultrasonic_cm.toFixed(1):'--','cm');
sv('s_ir',d.ir_obstacle!=null?(d.ir_obstacle?'Detectado':'Libre'):'--','');
sv('s_tof',d.tof_cm!=null?d.tof_cm.toFixed(1):'--','cm');
sv('s_gps_lat',d.gps_valid?(d.lat!=null?d.lat.toFixed(6):'Sin fix'):'Sin GPS','');
sv('s_gps_lon',d.gps_valid?(d.lng!=null?d.lng.toFixed(6):'--'):'--','');
sv('s_gps_sats',d.satellites!=null?d.satellites:'--','');
function hc(i,ok){$(i).innerHTML=ok?'<span style="color:#0d904f;font-weight:600">OK</span>':'<span style="color:#cb2938;font-weight:600">Error</span>';}
function ec(i,en){$(i).innerHTML=en?'<span style="color:#0d904f">Activo</span>':'<span style="color:#999">Desactivado</span>';}
if(d.sensor_health){hc('sh0',d.sensor_health[0]);hc('sh1',d.sensor_health[1]);hc('sh2',d.sensor_health[2]);hc('sh3',d.sensor_health[3]);hc('sh4',d.sensor_health[4]);hc('sh5',d.sensor_health[5]);}
if(d.sensor_enabled_arr){ec('se0',d.sensor_enabled_arr[0]);ec('se1',d.sensor_enabled_arr[1]);ec('se2',d.sensor_enabled_arr[2]);ec('se3',d.sensor_enabled_arr[3]);ec('se4',d.sensor_enabled_arr[4]);ec('se5',d.sensor_enabled_arr[5]);}
var icons=['s_dht_icon','s_mq_icon','s_ultra_icon','s_ir_icon','s_tof_icon','s_gps_icon'];
if(d.sensor_health&&d.sensor_enabled_arr){icons.forEach(function(i,idx){$(i).className='sensor-icon '+(d.sensor_enabled_arr[idx]?(d.sensor_health[idx]?'ok':'er'):'off');});}
}
async function poll(){try{var r=await fetch('/api/status');if(r.ok)upd(await r.json())}catch(e){}}
async function pollSensors(){try{var r=await fetch('/api/sensors');if(r.ok)upds(await r.json())}catch(e){}}
async function pollRadio(){try{var r=await fetch('/api/lora_radio');if(r.ok)updr(await r.json())}catch(e){}}
function updr(d){
if(!d)return;
$('lr_rssi').textContent=d.rssi!=null?d.rssi.toFixed(1)+' dBm':'--';
$('lr_snr').textContent=d.snr!=null?d.snr.toFixed(1)+' dB':'--';
$('lr_noise').textContent=d.noise!=null?d.noise.toFixed(1)+' dBm':'--';
$('lr_tx').textContent=d.tx_count||0;
$('lr_rx').textContent=d.rx_count||0;
$('lr_qual').textContent=d.quality||'--';
var q=d.rssi||0;
var pct=Math.max(0,Math.min(100,((q+120)/80)*100));
var bar=$('lr_bar');
bar.style.width=pct+'%';
if(q>-80){bar.style.background='var(--green)';$('lr_qual_sub').textContent='Cobertura optima';}
else if(q>-100){bar.style.background='var(--blue)';$('lr_qual_sub').textContent='Cobertura buena';}
else if(q>-110){bar.style.background='var(--orange)';$('lr_qual_sub').textContent='Cobertura limitada';}
else{bar.style.background='var(--red)';$('lr_qual_sub').textContent='Muy lejos o sin signal';}
$('lr_bar_text').textContent=q!=0?q.toFixed(1)+' dBm':'Sin datos';
}
async function loadCfg(){try{var r=await fetch('/api/config');if(r.ok){var c=await r.json();$('cnid').value=c.node_id||'';$('csi').value=c.send_interval||30000;$('cds').value=c.deep_sleep?1:0;$('clf').value=c.lora_freq||433}}catch(e){}}
async function saveId(){var c={node_id:$('cnid').value};try{var r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});var d=await r.json();if(d.ok){alert('Node ID guardado.');loadCfg()}else alert(d.error||'Error')}catch(e){alert('Error')}}
async function saveInterval(){var c={send_interval:parseInt($('csi').value)||30000};try{var r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});var d=await r.json();if(d.ok)alert('Intervalo guardado.');else alert(d.error||'Error')}catch(e){alert('Error')}}
async function saveDs(){var c={deep_sleep:parseInt($('cds').value)||0};try{var r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});var d=await r.json();if(d.ok)alert('Deep sleep guardado.');else alert(d.error||'Error')}catch(e){alert('Error')}}
async function saveLora(){var c={lora_freq:parseInt($('clf').value)||433};try{var r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});var d=await r.json();if(d.ok)alert('LoRa guardado. Reinicie para aplicar.');else alert(d.error||'Error')}catch(e){alert('Error')}}
async function toggleSensor(idx,en){var c={sensor_mask:0};for(var i=0;i<6;i++){c.sensor_mask|=(($('sw'+i).checked||(i===idx&&en))?1:0)<<i;}
try{var r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});var d=await r.json();if(!d.ok)alert(d.error||'Error')}catch(e){alert('Error')}}
function doReboot(){if(confirm('Reiniciar el nodo?'))fetch('/api/reboot',{method:'POST'}).then(()=>alert('Reiniciando...'))}
function doReset(){if(confirm('Restablecer valores de fabrica?'))fetch('/api/reset',{method:'POST'}).then(()=>{alert('Valores restaurados.');loadCfg();poll()})}
function doExitAP(){if(confirm('Salir del modo AP?'))fetch('/api/exit_ap',{method:'POST'}).then(()=>alert('Saliendo...'))}
poll();pollSensors();pollRadio();loadCfg();
setInterval(poll,2000);setInterval(pollSensors,2000);setInterval(pollRadio,1000);
</script>
</body></html>
)rawliteral";

// ===================== HANDLERS =====================

static void handle_index() {
  server.send_P(200, "text/html", INDEX_HTML);
}

static void handle_status() {
  SensorData sd = sensor_read_all();
  int sensors_ok = 0;
  int sensors_enabled_count = 0;
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (sensor_enabled[i]) sensors_enabled_count++;
    if (sensor_enabled[i] && sensor_healthy[i]) sensors_ok++;
  }

  String json = "{";
  json += "\"uptime\":" + String(millis() / 1000);
  json += ",\"heap\":" + String(ESP.getFreeHeap());
  json += ",\"node_id\":\"" + String(cfg_node_id) + "\"";
  json += ",\"lora_ready\":" + String(lora_ready ? "true" : "false");
  json += ",\"lora_freq\":" + String(cfg_lora_freq);
  json += ",\"send_interval\":" + String(cfg_send_interval);
  json += ",\"deep_sleep\":" + String(cfg_deep_sleep ? "true" : "false");
  json += ",\"sensors_ok\":" + String(sensors_ok);
  json += ",\"sensors_enabled\":" + String(sensors_enabled_count);
  json += ",\"sensor_mask\":" + String(cfg_sensor_mask);
  json += ",\"batt_voltage\":" + String(sd.batt_voltage, 2);
  json += ",\"batt_current_ma\":" + String(sd.batt_current_ma, 1);
  json += ",\"batt_soc_percent\":" + String(sd.batt_soc_percent, 1);
  json += ",\"batt_low\":" + String(sd.batt_low ? "true" : "false");
  json += ",\"batt_critical\":" + String(sd.batt_critical ? "true" : "false");
  json += ",\"ip\":\"192.168.4.1\"";
  json += "}";
  server.send(200, "application/json", json);
}

static void handle_sensors() {
  SensorData sd = sensor_read_all();

  String json = "{";
  json += "\"batt_voltage\":" + String(sd.batt_voltage, 2);
  json += ",\"batt_current_ma\":" + String(sd.batt_current_ma, 1);
  json += ",\"batt_power_mw\":" + String(sd.batt_power_mw, 0);
  json += ",\"batt_soc_percent\":" + String(sd.batt_soc_percent, 1);
  json += ",\"batt_remaining_mah\":" + String(sd.batt_remaining_mah, 0);
  json += ",\"batt_consumed_mah\":" + String(sd.batt_consumed_mah, 1);
  json += ",\"batt_runtime_min\":" + String(sd.batt_runtime_min, 0);
  json += ",\"batt_energy_consumed_mwh\":" + String(sd.batt_energy_consumed_mwh, 1);
  json += ",\"batt_energy_total_mwh\":" + String(sd.batt_energy_total_mwh, 0);
  json += ",\"batt_low\":" + String(sd.batt_low ? "true" : "false");
  json += ",\"batt_critical\":" + String(sd.batt_critical ? "true" : "false");
  json += ",\"air_quality\":" + String(sd.air_quality_raw);
  json += ",\"ultrasonic_cm\":" + String(sd.distance_cm, 1);
  json += ",\"ir_obstacle\":" + String(sd.obstacle ? "true" : "false");
  json += ",\"tof_cm\":" + String(sd.tof_mm / 10.0, 1);
  json += ",\"lat\":" + String(sd.lat, 6);
  json += ",\"lng\":" + String(sd.lng, 6);
  json += ",\"satellites\":" + String(sd.satellites);
  json += ",\"gps_valid\":" + String(sd.gps_valid ? "true" : "false");
  json += ",\"sensor_health\":[";
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (i > 0) json += ",";
    json += String(sensor_healthy[i] ? "true" : "false");
  }
  json += "],\"sensor_enabled_arr\":[";
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (i > 0) json += ",";
    json += String(sensor_enabled[i] ? "true" : "false");
  }
  json += "]}";
  server.send(200, "application/json", json);
}

static void handle_config_get() {
  String json = "{";
  json += "\"node_id\":\"" + String(cfg_node_id) + "\"";
  json += ",\"send_interval\":" + String(cfg_send_interval);
  json += ",\"lora_freq\":" + String(cfg_lora_freq);
  json += ",\"deep_sleep\":" + String(cfg_deep_sleep ? "true" : "false");
  json += ",\"sensor_mask\":" + String(cfg_sensor_mask);
  json += "}";
  server.send(200, "application/json", json);
}

static int extract_int(const String& body, const char* key) {
  int idx = body.indexOf(key);
  if (idx < 0) return -1;
  int start = body.indexOf(':', idx) + 1;
  String numStr = "";
  while (start < (int)body.length() && (isDigit(body[start]) || body[start] == '-')) {
    numStr += body[start++];
  }
  return numStr.length() > 0 ? numStr.toInt() : -1;
}

static String extract_str(const String& body, const char* key) {
  int idx = body.indexOf(key);
  if (idx < 0) return "";
  int start = body.indexOf(':', idx) + 1;
  int q1 = body.indexOf('"', start) + 1;
  int q2 = body.indexOf('"', q1);
  if (q2 > q1) return body.substring(q1, q2);
  return "";
}

static void handle_config_post() {
  String body = server.arg("plain");

  String nid = extract_str(body, "node_id");
  if (nid.length() > 0 && nid.length() < 32) {
    strncpy(cfg_node_id, nid.c_str(), sizeof(cfg_node_id) - 1);
  }

  int si = extract_int(body, "send_interval");
  if (si >= MIN_SEND_INTERVAL) cfg_send_interval = si;

  int lf = extract_int(body, "lora_freq");
  if (lf > 0) cfg_lora_freq = lf;

  int ds = extract_int(body, "deep_sleep");
  if (ds >= 0) cfg_deep_sleep = ds;

  int sm = extract_int(body, "sensor_mask");
  if (sm >= 0 && sm <= 63) {
    cfg_sensor_mask = (uint8_t)sm;
    sensor_set_mask(cfg_sensor_mask);
  }

  node_config_save();
  server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Configuracion guardada.\"}");
}

static void handle_reboot() {
  server.send(200, "application/json", "{\"ok\":true}");
  delay(1000);
  ESP.restart();
}

static void handle_reset() {
  cfg_prefs.begin("node", false);
  cfg_prefs.clear();
  cfg_prefs.end();
  strncpy(cfg_node_id, NODE_ID, sizeof(cfg_node_id) - 1);
  cfg_send_interval = SEND_INTERVAL;
  cfg_lora_freq = (int)(LORA_FREQ / 1000000);
  cfg_deep_sleep = DEEP_SLEEP_ENABLE;
  cfg_sensor_mask = DEFAULT_SENSOR_MASK;
  sensor_set_mask(cfg_sensor_mask);
  node_config_save();
  server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Valores por defecto restaurados.\"}");
}

static void handle_exit_ap() {
  server.send(200, "application/json", "{\"ok\":true}");
  delay(500);
  WiFi.mode(WIFI_OFF);
  WiFi.disconnect(true);
  delay(300);
  ESP.restart();
}

static void handle_lora_radio() {
  float noise = lora_ready ? lora_read_noise() : -127;

  String quality;
  if (lora_last_rssi == 0 && noise > -100) quality = "Sin paquetes";
  else if (lora_last_rssi > -80) quality = "Excelente";
  else if (lora_last_rssi > -100) quality = "Buena";
  else if (lora_last_rssi > -110) quality = "Regular";
  else if (lora_last_rssi != 0) quality = "Debil";
  else quality = "Sin datos";

  String json = "{";
  json += "\"lora_ready\":" + String(lora_ready ? "true" : "false");
  json += ",\"freq\":" + String(cfg_lora_freq);
  json += ",\"bw\":125";
  json += ",\"sf\":7";
  json += ",\"cr\":\"4/5\"";
  json += ",\"tx_power\":20";
  json += ",\"rssi\":" + String(lora_last_rssi, 1);
  json += ",\"snr\":" + String(lora_last_snr, 1);
  json += ",\"noise\":" + String(noise, 1);
  json += ",\"tx_count\":" + String(lora_tx_count);
  json += ",\"rx_count\":" + String(lora_rx_count);
  json += ",\"quality\":\"" + quality + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

// ===================== PUBLIC =====================

void node_config_load() {
  cfg_prefs.begin("node", true);
  strncpy(cfg_node_id, cfg_prefs.getString("n_id", NODE_ID).c_str(), sizeof(cfg_node_id) - 1);
  cfg_send_interval = cfg_prefs.getInt("s_int", SEND_INTERVAL);
  cfg_lora_freq = cfg_prefs.getInt("l_freq", (int)(LORA_FREQ / 1000000));
  cfg_deep_sleep = cfg_prefs.getInt("d_sleep", DEEP_SLEEP_ENABLE);
  cfg_sensor_mask = cfg_prefs.getUChar("s_mask", DEFAULT_SENSOR_MASK);
  cfg_prefs.end();
}

void node_config_save() {
  cfg_prefs.begin("node", false);
  cfg_prefs.putString("n_id", cfg_node_id);
  cfg_prefs.putInt("s_int", cfg_send_interval);
  cfg_prefs.putInt("l_freq", cfg_lora_freq);
  cfg_prefs.putInt("d_sleep", cfg_deep_sleep);
  cfg_prefs.putUChar("s_mask", cfg_sensor_mask);
  cfg_prefs.end();
}

void node_config_start_ap() {
  node_config_load();
  sensor_set_mask(cfg_sensor_mask);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(NODE_AP_SSID, NODE_AP_PASS, NODE_AP_CHANNEL, 0, NODE_AP_MAX_CONN);
  ap_active = true;

  Serial.println("=== MODO AP ACTIVADO ===");
  Serial.print("SSID: ");
  Serial.println(NODE_AP_SSID);
  Serial.print("IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.print("Sensores mask: 0b");
  Serial.println(cfg_sensor_mask, BIN);

  server.on("/", HTTP_GET, handle_index);
  server.on("/api/status", HTTP_GET, handle_status);
  server.on("/api/sensors", HTTP_GET, handle_sensors);
  server.on("/api/config", HTTP_GET, handle_config_get);
  server.on("/api/config", HTTP_POST, handle_config_post);
  server.on("/api/reboot", HTTP_POST, handle_reboot);
  server.on("/api/reset", HTTP_POST, handle_reset);
  server.on("/api/exit_ap", HTTP_POST, handle_exit_ap);
  server.on("/api/lora_radio", HTTP_GET, handle_lora_radio);

  server.enableCORS(true);
  server.begin();
  dns_server.start(53, "*", WiFi.softAPIP());
  Serial.println("Web server nodo iniciado en puerto " + String(NODE_WEB_PORT));
  Serial.println("DNS: nodo.lora -> " + WiFi.softAPIP().toString());
}

void node_config_web_loop() {
  if (ap_active) {
    dns_server.processNextRequest();
    server.handleClient();
  }
}

bool node_config_is_ap_active() {
  return ap_active;
}

const char* node_config_get_id() {
  return cfg_node_id;
}

int node_config_get_interval() {
  return cfg_send_interval;
}

int node_config_get_lora_freq() {
  return cfg_lora_freq;
}

int node_config_get_deep_sleep() {
  return cfg_deep_sleep;
}

uint8_t node_config_get_sensor_mask() {
  return cfg_sensor_mask;
}

int node_config_get_wifi_mode() {
  return 1;
}

void node_config_set_ap_request() {
  cfg_prefs.begin("node", false);
  cfg_prefs.putBool("ap_request", true);
  cfg_prefs.end();
}
