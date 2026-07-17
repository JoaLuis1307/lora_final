#include "web_service.h"
#include "../../config.h"
#include <WebServer.h>
#include <Preferences.h>
#include "../drivers/wifi_driver.h"
#include "../drivers/lora_driver.h"
#include "../services/mqtt_service.h"
#include "../services/router_service.h"
#include "../services/parser_service.h"
#include "../services/node_store.h"

static WebServer server(WEB_PORT);
static Preferences prefs;

static char cfg_wifi_ssid[64] = "";
static char cfg_wifi_pass[64] = "";
static char cfg_mqtt_server[64] = "";
static int cfg_mqtt_port = 1883;
static char cfg_mqtt_user[32] = "";
static char cfg_mqtt_pass[32] = "";
static char cfg_gateway_id[32] = "gateway_01";
static int cfg_lora_freq = 433;

static char cfg_web_user[32] = WEB_DEFAULT_USER;
static char cfg_web_pass[32] = WEB_DEFAULT_PASS;

static const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IoT Gateway - Administracion</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--navy:#1b2a4a;--navy-l:#243656;--blue:#049fd9;--blue-d:#038ab8;--green:#0d904f;--red:#cb2938;--orange:#e87500;--bg:#eef1f5;--card:#fff;--border:#d4d8dd;--txt:#24292e;--muted:#6a737d;--hover:#f6f8fa}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;font-size:14px;line-height:1.5}
.topbar{background:var(--navy);color:#fff;height:48px;display:flex;align-items:center;padding:0 20px;position:fixed;top:0;left:0;right:0;z-index:200}
.topbar .logo{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;letter-spacing:.3px}
.topbar .logo svg{width:28px;height:28px}
.topbar .sep{width:1px;height:24px;background:rgba(255,255,255,.2);margin:0 16px}
.topbar .model{font-size:12px;color:rgba(255,255,255,.6);font-weight:400}
.topbar .status-badge{margin-left:auto;font-size:11px;padding:3px 10px;border-radius:3px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.topbar .status-badge.on{background:rgba(13,144,79,.2);color:#4cd964;border:1px solid rgba(13,144,79,.3)}
.topbar .status-badge.off{background:rgba(203,41,56,.2);color:#ff6b6b;border:1px solid rgba(203,41,56,.3)}
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
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin:16px 0}
.stat{background:#fff;padding:12px;text-align:center}
.stat .val{font-size:18px;font-weight:700;color:var(--navy);font-family:'SF Mono',Monaco,Consolas,monospace}
.stat .lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:2px}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.fg input,.fg select{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:3px;font-size:13px;font-family:inherit;background:#fff;transition:border-color .15s}
.fg input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 2px rgba(4,159,217,.15)}
.fg .help{font-size:11px;color:var(--muted);margin-top:3px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.btn{padding:7px 16px;border:1px solid transparent;border-radius:3px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.3px}
.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue-d)}.btn-primary:hover{background:var(--blue-d)}
.btn-danger{background:var(--red);color:#fff;border-color:#b0222f}.btn-danger:hover{background:#b0222f}
.btn-outline{background:transparent;color:var(--blue);border-color:var(--border)}.btn-outline:hover{background:#f0f7fb}
.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.node-card{border:1px solid var(--border);border-radius:4px;margin-bottom:10px;overflow:hidden}
.node-header{padding:10px 14px;background:#f6f8fa;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.node-id{font-weight:700;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:13px;color:var(--navy)}
.node-badge{font-size:10px;padding:2px 8px;border-radius:2px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.node-badge.on{background:#d4edda;color:#155724}.node-badge.off{background:#f8d7da;color:#721c24}
.node-time{margin-left:auto;font-size:11px;color:var(--muted);font-family:'SF Mono',Monaco,Consolas,monospace}
.node-body{padding:10px 14px}
.node-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-radius:3px;overflow:hidden}
.node-cell{background:#fff;padding:8px;text-align:center}
.node-cell .k{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;display:block}
.node-cell .v{font-size:13px;font-weight:700;font-family:'SF Mono',Monaco,Consolas,monospace;display:block;margin-top:1px}
.node-footer{padding:8px 14px;background:#fafbfc;border-top:1px solid var(--border);font-size:11px;color:var(--muted);font-family:'SF Mono',Monaco,Consolas,monospace;display:flex;gap:16px}
.empty{text-align:center;padding:40px;color:var(--muted)}
.empty svg{width:40px;height:40px;margin-bottom:8px;opacity:.3}
.menu-toggle{display:none;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;margin-right:12px}
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);width:220px;transition:transform .2s}.sidebar.open{transform:translateX(0)}
  .main{margin-left:0}.menu-toggle{display:block}
  .status-grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,1fr)}.row2,.row3{grid-template-columns:1fr}
  .node-grid{grid-template-columns:repeat(2,1fr)}
  .content{padding:14px}
}
</style>
</head><body>

<div class="topbar">
<button class="menu-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">&#9776;</button>
<div class="logo">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
<span>IoT Gateway</span>
</div>
<div class="sep"></div>
<span class="model">ESP32-S3 | LoRa 433MHz | MQTT</span>
<span class="status-badge on" id="badge">ONLINE</span>
</div>

<div class="sidebar" id="sidebar">
<nav id="nv">
<a class="on" data-p="panel" onclick="go('panel')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
Panel</a>
<a data-p="red" onclick="go('red')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
Red</a>
<a data-p="lora" onclick="go('lora')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
LoRa</a>
<a data-p="nodos" onclick="go('nodosp')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
Nodos</a>
<a data-p="config" onclick="go('config')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
Configuracion</a>
<a data-p="tools" onclick="go('tools')">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
Herramientas</a>
</nav>
</div>

<div class="main">
<div class="breadcrumb">IoT Gateway &rsaquo; <b id="pt">Panel de Control</b></div>
<div class="content">

<div id="panel" class="page on">
<div class="status-grid">
<div class="status-item"><div class="status-dot" id="wdot"></div><div><div class="status-label">Red</div><div class="status-value" id="vw">--</div><div class="status-sub" id="tw">--</div></div></div>
<div class="status-item"><div class="status-dot" id="mdot"></div><div><div class="status-label">Broker</div><div class="status-value" id="vm">--</div><div class="status-sub" id="tm">--</div></div></div>
<div class="status-item"><div class="status-dot" id="ldot"></div><div><div class="status-label">Radio LoRa</div><div class="status-value" id="vl">--</div><div class="status-sub" id="tl">--</div></div></div>
</div>
<div class="stats">
<div class="stat"><div class="val" id="vu">--</div><div class="lbl">Uptime</div></div>
<div class="stat"><div class="val" id="vh">--</div><div class="lbl">Memoria</div></div>
<div class="stat"><div class="val" id="vp">0</div><div class="lbl">Paquetes</div></div>
<div class="stat"><div class="val" id="ve">0</div><div class="lbl">CRC Errores</div></div>
<div class="stat"><div class="val" id="vr">--</div><div class="lbl">Senal</div></div>
<div class="stat"><div class="val" id="vn2">0</div><div class="lbl">Nodos</div></div>
</div>
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Informacion del Sistema</div><div class="card-body">
<table class="tbl"><tr><td style="width:40%">Direccion IP</td><td class="mono" id="vi">--</td></tr>
<tr><td>Modo de Red</td><td id="vmd">STA</td></tr>
<tr><td>SSID Asignado</td><td id="vssid">--</td></tr></table>
</div></div>
</div>

<div id="red" class="page">
<div class="card"><div class="card-head"><span class="dot dot-g" id="wdot2"></span>Estado de la Red</div><div class="card-body">
<table class="tbl"><tr><td style="width:40%">Modo</td><td id="rm">STA</td></tr>
<tr><td>Estado</td><td id="rs">--</td></tr>
<tr><td>Direccion IP</td><td class="mono" id="ri">--</td></tr>
<tr><td>Nivel de Senal</td><td id="rr">--</td></tr></table>
</div></div>
<div class="card"><div class="card-head">Estacion (STA) - Configuracion</div><div class="card-body">
<div class="row2">
<div class="fg"><label>SSID de la Red</label><input id="cws" placeholder="Nombre de red"><div class="help">Red a la que se conecta el gateway como cliente</div></div>
<div class="fg"><label>Clave de Acceso</label><input id="cwp" type="password" placeholder="Dejar vacio para no cambiar"></div>
</div>
<div class="actions"><button class="btn btn-primary" onclick="saveWifi()">Aplicar Cambios</button></div>
</div></div>
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Punto de Acceso (AP)</div><div class="card-body">
<table class="tbl"><tr><td style="width:40%">SSID del AP</td><td class="mono">IoT-Gateway</td></tr>
<tr><td>Clave de Acceso</td><td class="mono">12345678</td></tr>
<tr><td>Clientes Maximos</td><td>4</td></tr>
<tr><td>Canal</td><td>1</td></tr></table>
<div style="margin-top:12px;padding:10px;background:#f6f8fa;border-radius:3px;font-size:12px;color:var(--muted)">Doble pulsacion del boton de hardware para activar modo AP</div>
</div></div>
</div>

<div id="lora" class="page">
<div class="card"><div class="card-head"><span class="dot dot-g" id="ldot2"></span>Estado del Enlace LoRa</div><div class="card-body">
<div class="row3">
<div><div class="status-label">Frecuencia</div><div style="font-size:18px;font-weight:700;font-family:monospace" id="lf">433 MHz</div></div>
<div><div class="status-label">Estado</div><div style="font-size:18px;font-weight:700" id="ls">--</div></div>
<div><div class="status-label">Nodos Activos</div><div style="font-size:18px;font-weight:700" id="ln">0</div></div>
</div>
</div></div>
<div class="card"><div class="card-head">Nodos Registrados</div><div class="card-body">
<div id="ncl"><div class="empty">Esperando datos de nodos...</div></div>
</div></div>
</div>

<div id="nodos" class="page">
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Gestion de Nodos (Whitelist)</div><div class="card-body">
<p style="font-size:12px;color:var(--muted);margin-bottom:14px">Solo los nodos registrados en la whitelist pueden enviar datos al gateway. Si la lista esta vacia, se aceptan todos los nodos.</p>
<table class="tbl"><thead><tr><th>Nodo ID</th><th>Accion</th></tr></thead><tbody id="wlt"></tbody></table>
<div id="wlempty" class="empty" style="padding:20px">Whitelist vacia - Todos los nodos son aceptados</div>
<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
<label style="display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;font-weight:600;margin-bottom:6px">Agregar Nodo</label>
<div style="display:flex;gap:8px">
<input id="newNid" placeholder="ID del nodo (ej: NODO01)" style="flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:3px;font-size:13px;font-family:inherit">
<button class="btn btn-primary" onclick="addNode()">Agregar</button>
</div>
</div>
</div></div>
<div class="card"><div class="card-head"><span class="dot dot-y"></span>Seguridad del Gateway</div><div class="card-body">
<p style="font-size:12px;color:var(--muted);margin-bottom:14px">Credenciales de acceso al panel de administracion web.</p>
<div class="row2">
<div class="fg"><label>Usuario</label><input id="cwebu" placeholder="Usuario de acceso"></div>
<div class="fg"><label>Clave de Acceso</label><input id="cwebp" type="password" placeholder="Dejar vacio para no cambiar"></div>
</div>
<div class="actions"><button class="btn btn-primary" onclick="saveWebCreds()">Actualizar Credenciales</button></div>
</div></div>
</div>

<div id="config" class="page">
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Servidor MQTT (Broker)</div><div class="card-body">
<div class="row2">
<div class="fg"><label>Servidor</label><input id="cms" placeholder="192.168.1.100"><div class="help">IP o dominio del broker MQTT</div></div>
<div class="fg"><label>Puerto</label><input id="cmp" type="number" placeholder="1883"></div>
</div>
<div class="row2">
<div class="fg"><label>Credencial</label><input id="cmu" placeholder="Usuario MQTT"></div>
<div class="fg"><label>Clave</label><input id="cmw" type="password" placeholder="Dejar vacio para no cambiar"></div>
</div>
<div class="fg"><label>Identificador del Gateway</label><input id="cmg" placeholder="gateway_01"><div class="help">ID unico de este dispositivo en la red MQTT</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveMqtt()">Aplicar Cambios</button></div>
</div></div>
<div class="card"><div class="card-head">Configuracion LoRa</div><div class="card-body">
<div class="fg"><label>Frecuencia de Operacion (MHz)</label><input id="clf" type="number" placeholder="433"><div class="help">Debe coincidir con la frecuencia de los nodos remotos</div></div>
<div class="actions"><button class="btn btn-primary" onclick="saveLora()">Aplicar Cambios</button></div>
</div></div>
</div>

<div id="tools" class="page">
<div class="card"><div class="card-head"><span class="dot dot-y"></span>Mantenimiento del Sistema</div><div class="card-body">
<div class="actions">
<button class="btn btn-primary" onclick="doReboot()">Reiniciar Gateway</button>
<button class="btn btn-danger" onclick="doReset()">Restablecer Valores de Fabrica</button>
</div>
</div></div>
<div class="card"><div class="card-head"><span class="dot dot-b"></span>Informacion del Firmware</div><div class="card-body">
<table class="tbl"><tr><td style="width:40%">Version</td><td class="mono">1.0</td></tr>
<tr><td>Placa</td><td>ESP32-S3</td></tr>
<tr><td>Memoria Disponible</td><td class="mono" id="th">--</td></tr>
<tr><td>Tiempo Activo</td><td id="tu">--</td></tr>
<tr><td>Frecuencia LoRa</td><td class="mono" id="tf">433 MHz</td></tr></table>
</div></div>
</div>

</div>
</div>

<script>
var $=id=>document.getElementById(id);
var T={panel:'Panel de Control',red:'Red',lora:'LoRa / Nodos',nodosp:'Gestion de Nodos',config:'Configuracion',tools:'Herramientas'};
function go(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));document.querySelectorAll('#nv a').forEach(x=>x.classList.remove('on'));var pid=p;if(p==='nodosp')pid='nodos';$(pid).classList.add('on');document.querySelector('[data-p="'+p+'"]').classList.add('on');$('pt').textContent=T[p]||p;$('sidebar').classList.remove('open')}
function fmt(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m '+s%60+'s';return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m'}
function upd(d){
var w=d.wifi_connected,m=d.mqtt_connected,l=d.lora_alive;
$('badge').textContent=w?'ONLINE':'OFFLINE';$('badge').className='status-badge '+(w?'on':'off');
$('vw').textContent=w?'Online':'Offline';$('wdot').className='status-dot '+(w?'ok':'er');
$('vm').textContent=m?'Online':'Offline';$('mdot').className='status-dot '+(m?'ok':'er');
$('vl').textContent=l?'Online':'Offline';$('ldot').className='status-dot '+(l?'ok':'er');
$('tm').textContent=d.mqtt_server||'--';
$('tl').textContent=(d.lora_freq||433)+' MHz';
$('vu').textContent=fmt(d.uptime||0);$('vh').textContent=d.heap?Math.round(d.heap/1024)+'K':'--';
$('vp').textContent=d.packets||0;$('ve').textContent=d.crc_errors||0;$('vr').textContent=(d.wifi_rssi||0)+'dBm';
$('vn2').textContent=d.node_count||0;$('vi').textContent=d.ip||'--';$('vmd').textContent=d.wifi_mode||'STA';
$('vssid').textContent=d.wifi_ssid||'--';
$('rm').textContent=d.wifi_mode||'STA';$('rs').textContent=w?'Online':'Offline';
$('ri').textContent=d.ip||'--';$('rr').textContent=(d.wifi_rssi||0)+' dBm';
if($('wdot2'))$('wdot2').className='dot '+(w?'dot-g':'dot-r');
if($('ldot2'))$('ldot2').className='dot '+(l?'dot-g':'dot-r');
$('lf').textContent=(d.lora_freq||433)+' MHz';$('ls').textContent=l?'Online':'Offline';
$('ln').textContent=d.node_count||0;
$('th').textContent=d.heap?Math.round(d.heap/1024)+'K':'--';$('tu').textContent=fmt(d.uptime||0);
$('tf').textContent=(d.lora_freq||433)+' MHz';
}
function updn(a){
var c=$('ncl');if(!a||!a.length){c.innerHTML='<div class="empty">Esperando datos de nodos...</div>';return}
var h='';a.forEach(function(n){
var s=n.last_seen_sec,g=s<60;
h+='<div class="node-card"><div class="node-header"><span class="node-id">'+n.id+'</span>';
h+='<span class="node-badge '+(g?'on':'off')+'">'+(g?'En linea':'Sin conexion')+'</span>';
h+='<span class="node-time">'+(g?'hace '+s+'s':s+'s sin datos')+'</span></div>';
h+='<div class="node-body"><div class="node-grid">';
h+='<div class="node-cell"><span class="k">Bateria</span><span class="v">'+n.battery.toFixed(2)+'V</span></div>';
h+='<div class="node-cell"><span class="k">SOC</span><span class="v">'+n.battery_pct.toFixed(1)+'%</span></div>';
h+='<div class="node-cell"><span class="k">Calidad Aire</span><span class="v">'+n.air_quality+'</span></div>';
h+='<div class="node-cell"><span class="k">Ultrasonido</span><span class="v">'+n.ultrasonic_cm.toFixed(1)+'cm</span></div>';
h+='<div class="node-cell"><span class="k">Distancia TOF</span><span class="v">'+n.tof_cm+'cm</span></div>';
h+='<div class="node-cell"><span class="k">Infrarrojo</span><span class="v">'+(n.obstacle?'Detectado':'Libre')+'</span></div>';
h+='</div></div>';
h+='<div class="node-footer"><span>RSSI: '+n.rssi+'dBm</span><span>SNR: '+n.snr.toFixed(1)+'dB</span><span>Seq: #'+n.sequence+'</span></div></div>';
});c.innerHTML=h;
}
function updw(data){
var t=$('wlt'),e=$('wlempty');
if(!data||!data.nodes||!data.nodes.length){t.innerHTML='';e.style.display='block';return}
e.style.display='none';
var h='';data.nodes.forEach(function(id){
h+='<tr><td class="mono" style="font-weight:600">'+id+'</td>';
h+='<td><button class="btn btn-danger" style="padding:3px 10px;font-size:10px" onclick="rmNode(\''+id+'\')">Eliminar</button></td></tr>';
});t.innerHTML=h;
}
function gah(){var h=sessionStorage.getItem('auth');return h?{headers:{'Authorization':'Basic '+h}}:{}}
async function poll(){try{var r=await fetch('/api/status',gah());if(r.ok)upd(await r.json());var r2=await fetch('/api/nodes',gah());if(r2.ok)updn(await r2.json())}catch(e){}}
async function loadCfg(){try{var r=await fetch('/api/config',gah());if(r.ok){var c=await r.json();$('cws').value=c.wifi_ssid||'';$('cms').value=c.mqtt_server||'';$('cmp').value=c.mqtt_port||1883;$('cmu').value=c.mqtt_user||'';$('cmg').value=c.gateway_id||'';$('clf').value=c.lora_freq||433}}catch(e){}}
async function loadWL(){try{var r=await fetch('/api/whitelist',gah());if(r.ok)updw(await r.json())}catch(e){}}
async function saveWifi(){var c={wifi_ssid:$('cws').value,wifi_pass:$('cwp').value};try{var r=await fetch('/api/config',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify(c)}));if(r.ok)alert('WiFi guardado. Reinicie para aplicar.');else alert('Error')}catch(e){alert('Error')}}
async function saveMqtt(){var c={mqtt_server:$('cms').value,mqtt_port:parseInt($('cmp').value)||1883,mqtt_user:$('cmu').value,mqtt_pass:$('cmw').value,gateway_id:$('cmg').value};try{var r=await fetch('/api/config',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify(c)}));if(r.ok)alert('MQTT guardado. Reinicie para aplicar.');else alert('Error')}catch(e){alert('Error')}}
async function saveLora(){var c={lora_freq:parseInt($('clf').value)||433};try{var r=await fetch('/api/config',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify(c)}));if(r.ok)alert('LoRa guardado. Reinicie para aplicar.');else alert('Error')}catch(e){alert('Error')}}
function addNode(){
var id=$('newNid').value.trim();
if(!id){alert('Ingrese un ID de nodo');return}
if(id.length>15){alert('El ID no puede exceder 15 caracteres');return}
fetch('/api/whitelist/add',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify({node_id:id})}))
.then(function(r){return r.json()}).then(function(d){
if(d.ok){alert('Nodo '+id+' agregado');$('newNid').value='';loadWL()}
else{alert(d.error||'Error al agregar nodo')}
}).catch(function(){alert('Error de conexion')});
}
function rmNode(id){
if(!confirm('Eliminar nodo '+id+' de la whitelist?'))return;
fetch('/api/whitelist/remove',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify({node_id:id})}))
.then(function(r){return r.json()}).then(function(d){
if(d.ok){loadWL()}else{alert(d.error||'Error al eliminar nodo')}
}).catch(function(){alert('Error de conexion')});
}
function saveWebCreds(){
var u=$('cwebu').value.trim(),p=$('cwebp').value;
if(!u){alert('Ingrese un usuario');return}
var body={web_user:u};
if(p)body.web_pass=p;
fetch('/api/webcreds',Object.assign({method:'POST',headers:{'Content-Type':'application/json'}},gah(),{body:JSON.stringify(body)}))
.then(function(r){return r.json()}).then(function(d){
if(d.ok){alert('Credenciales actualizadas. Use las nuevas credenciales para la proxima sesion.');$('cwebp').value=''}
else{alert(d.error||'Error')}
}).catch(function(){alert('Error de conexion')});
}
function doReboot(){if(confirm('Reiniciar el gateway?'))fetch('/api/reboot',Object.assign({method:'POST'},gah())).then(()=>alert('Reiniciando...'))}
function doReset(){if(confirm('Restablecer valores de fabrica? Todos los cambios se perderan.'))fetch('/api/reset',Object.assign({method:'POST'},gah())).then(()=>{alert('Valores restaurados. Reinicie el gateway.');loadCfg()})}
poll();loadCfg();loadWL();setInterval(poll,2000);setInterval(loadWL,10000);
</script>
</body></html>
)rawliteral";

static void config_load() {
  prefs.begin("gw", true);
  strncpy(cfg_wifi_ssid, prefs.getString("w_ssid", WIFI_SSID).c_str(), sizeof(cfg_wifi_ssid) - 1);
  strncpy(cfg_wifi_pass, prefs.getString("w_pass", WIFI_PASSWORD).c_str(), sizeof(cfg_wifi_pass) - 1);
  strncpy(cfg_mqtt_server, prefs.getString("m_srv", MQTT_SERVER).c_str(), sizeof(cfg_mqtt_server) - 1);
  cfg_mqtt_port = prefs.getInt("m_port", MQTT_PORT);
  strncpy(cfg_mqtt_user, prefs.getString("m_usr", MQTT_USER).c_str(), sizeof(cfg_mqtt_user) - 1);
  strncpy(cfg_mqtt_pass, prefs.getString("m_psw", MQTT_PASS).c_str(), sizeof(cfg_mqtt_pass) - 1);
  strncpy(cfg_gateway_id, prefs.getString("g_id", MQTT_GATEWAY_ID).c_str(), sizeof(cfg_gateway_id) - 1);
  cfg_lora_freq = prefs.getInt("l_freq", (int)(LORA_FREQ / 1000000));
  strncpy(cfg_web_user, prefs.getString("w_user", WEB_DEFAULT_USER).c_str(), sizeof(cfg_web_user) - 1);
  strncpy(cfg_web_pass, prefs.getString("w_wpass", WEB_DEFAULT_PASS).c_str(), sizeof(cfg_web_pass) - 1);
  prefs.end();
}

static void config_save() {
  prefs.begin("gw", false);
  prefs.putString("w_ssid", cfg_wifi_ssid);
  prefs.putString("w_pass", cfg_wifi_pass);
  prefs.putString("m_srv", cfg_mqtt_server);
  prefs.putInt("m_port", cfg_mqtt_port);
  prefs.putString("m_usr", cfg_mqtt_user);
  prefs.putString("m_psw", cfg_mqtt_pass);
  prefs.putString("g_id", cfg_gateway_id);
  prefs.putInt("l_freq", cfg_lora_freq);
  prefs.putString("w_user", cfg_web_user);
  prefs.putString("w_wpass", cfg_web_pass);
  prefs.end();
}

static void config_reset() {
  prefs.begin("gw", false);
  prefs.clear();
  prefs.end();
}

static void handle_status() {
  String json = "{";
  json += "\"uptime\":" + String(millis() / 1000);
  json += ",\"heap\":" + String(ESP.getFreeHeap());
  json += ",\"wifi_rssi\":" + String(WiFi.RSSI());
  json += ",\"wifi_connected\":" + String(wifi_is_connected() ? "true" : "false");
  json += ",\"wifi_ssid\":\"" + String(cfg_wifi_ssid) + "\"";
  json += ",\"wifi_mode\":\"" + wifi_get_mode_str() + "\"";
  json += ",\"mqtt_connected\":" + String(mqtt_is_connected() ? "true" : "false");
  json += ",\"mqtt_server\":\"" + String(cfg_mqtt_server) + "\"";
  json += ",\"lora_alive\":" + String(lora_alive ? "true" : "false");
  json += ",\"lora_freq\":" + String(cfg_lora_freq);
  json += ",\"node_count\":" + String(stored_node_count);
  json += ",\"packets\":" + String(router_packets);
  json += ",\"crc_errors\":" + String(router_crc_errors);
  json += ",\"ip\":\"" + wifi_get_ip() + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

static void handle_nodes() {
  server.send(200, "application/json", node_store_get_json());
}

static void handle_config_get() {
  String json = "{";
  json += "\"wifi_ssid\":\"" + String(cfg_wifi_ssid) + "\"";
  json += ",\"wifi_pass\":\"\"";
  json += ",\"mqtt_server\":\"" + String(cfg_mqtt_server) + "\"";
  json += ",\"mqtt_port\":" + String(cfg_mqtt_port);
  json += ",\"mqtt_user\":\"" + String(cfg_mqtt_user) + "\"";
  json += ",\"mqtt_pass\":\"\"";
  json += ",\"gateway_id\":\"" + String(cfg_gateway_id) + "\"";
  json += ",\"lora_freq\":" + String(cfg_lora_freq);
  json += "}";
  server.send(200, "application/json", json);
}

static void handle_config_post() {
  String body = server.arg("plain");
  String val;

  val = parser_extract_value(body.c_str(), "wifi_ssid");
  if (val.length() > 0) strncpy(cfg_wifi_ssid, val.c_str(), sizeof(cfg_wifi_ssid) - 1);

  val = parser_extract_value(body.c_str(), "wifi_pass");
  if (val.length() > 0) strncpy(cfg_wifi_pass, val.c_str(), sizeof(cfg_wifi_pass) - 1);

  val = parser_extract_value(body.c_str(), "mqtt_server");
  if (val.length() > 0) strncpy(cfg_mqtt_server, val.c_str(), sizeof(cfg_mqtt_server) - 1);

  val = parser_extract_value(body.c_str(), "mqtt_port");
  if (val.length() > 0) cfg_mqtt_port = val.toInt();

  val = parser_extract_value(body.c_str(), "mqtt_user");
  if (val.length() > 0) strncpy(cfg_mqtt_user, val.c_str(), sizeof(cfg_mqtt_user) - 1);

  val = parser_extract_value(body.c_str(), "mqtt_pass");
  if (val.length() > 0) strncpy(cfg_mqtt_pass, val.c_str(), sizeof(cfg_mqtt_pass) - 1);

  val = parser_extract_value(body.c_str(), "gateway_id");
  if (val.length() > 0) strncpy(cfg_gateway_id, val.c_str(), sizeof(cfg_gateway_id) - 1);

  val = parser_extract_value(body.c_str(), "lora_freq");
  if (val.length() > 0) cfg_lora_freq = val.toInt();

  config_save();
  server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Configuracion guardada. Reinicie el gateway para aplicar cambios.\"}");
}

static void handle_reboot() {
  server.send(200, "application/json", "{\"ok\":true}");
  delay(1000);
  ESP.restart();
}

static void handle_reset() {
  config_reset();
  config_load();
  server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Valores por defecto restaurados.\"}");
}

static void handle_whitelist_get() {
  server.send(200, "application/json", node_whitelist_get_json());
}

static void handle_whitelist_add() {
  String body = server.arg("plain");
  String node_id = parser_extract_value(body.c_str(), "node_id");
  if (node_id.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"Falta node_id\"}");
    return;
  }
  bool ok = node_whitelist_add(node_id.c_str());
  if (ok) {
    server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Nodo " + node_id + " agregado a la whitelist.\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"No se pudo agregar. Verifique que no exista o que no se supere el limite.\"}");
  }
}

static void handle_whitelist_remove() {
  String body = server.arg("plain");
  String node_id = parser_extract_value(body.c_str(), "node_id");
  if (node_id.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"Falta node_id\"}");
    return;
  }
  bool ok = node_whitelist_remove(node_id.c_str());
  if (ok) {
    server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Nodo " + node_id + " eliminado de la whitelist.\"}");
  } else {
    server.send(404, "application/json", "{\"error\":\"Nodo no encontrado en la whitelist.\"}");
  }
}

static void handle_webcreds_post() {
  String body = server.arg("plain");
  String val;

  val = parser_extract_value(body.c_str(), "web_user");
  if (val.length() > 0) strncpy(cfg_web_user, val.c_str(), sizeof(cfg_web_user) - 1);

  val = parser_extract_value(body.c_str(), "web_pass");
  if (val.length() > 0) strncpy(cfg_web_pass, val.c_str(), sizeof(cfg_web_pass) - 1);

  config_save();
  server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Credenciales web actualizadas.\"}");
}

// ===================== AUTENTICACION =====================

static String base64_encode(const String& input) {
  const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out = "";
  int i = 0;
  int len = input.length();
  unsigned char c3[3];
  unsigned char c4[4];
  int j = 0;

  while (len--) {
    c3[j++] = input[i++];
    if (j == 3) {
      c4[0] = (c3[0] & 0xfc) >> 2;
      c4[1] = ((c3[0] & 0x03) << 4) | ((c3[1] & 0xf0) >> 4);
      c4[2] = ((c3[1] & 0x0f) << 2) | ((c3[2] & 0xc0) >> 6);
      c4[3] = c3[2] & 0x3f;
      for (j = 0; j < 4; j++) out += tbl[c4[j]];
      j = 0;
    }
  }
  if (j) {
    for (int k = j; k < 3; k++) c3[k] = 0;
    c4[0] = (c3[0] & 0xfc) >> 2;
    c4[1] = ((c3[0] & 0x03) << 4) | ((c3[1] & 0xf0) >> 4);
    c4[2] = ((c3[1] & 0x0f) << 2) | ((c3[2] & 0xc0) >> 6);
    for (int k = 0; k < j + 1; k++) out += tbl[c4[k]];
    while (j++ < 3) out += '=';
  }
  return out;
}

static bool check_auth() {
  if (!server.hasHeader("Authorization")) return false;
  String auth = server.header("Authorization");
  if (!auth.startsWith("Basic ")) return false;
  String decoded = auth.substring(6);
  String expected = base64_encode(String(cfg_web_user) + ":" + String(cfg_web_pass));
  return decoded == expected;
}

static bool auth_check() {
  if (check_auth()) return true;
  if (server.hasArg("__auth")) {
    String token = server.arg("__auth");
    String expected = base64_encode(String(cfg_web_user) + ":" + String(cfg_web_pass));
    if (token == expected) return true;
  }
  return false;
}

static void handle_login_page() {
  String html = R"rawliteral(
<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IoT Gateway - Acceso</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#eef1f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.login-box{background:#fff;border:1px solid #d4d8dd;border-radius:4px;width:360px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.login-top{background:#1b2a4a;padding:20px;text-align:center}
.login-top svg{width:40px;height:40px;margin-bottom:8px}
.login-top h2{color:#fff;font-size:16px;font-weight:600}
.login-top p{color:rgba(255,255,255,.5);font-size:11px;margin-top:4px}
.login-body{padding:24px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:11px;color:#6a737d;text-transform:uppercase;letter-spacing:.3px;font-weight:600;margin-bottom:4px}
.fg input{width:100%;padding:8px 12px;border:1px solid #d4d8dd;border-radius:3px;font-size:14px;font-family:inherit}
.fg input:focus{outline:none;border-color:#049fd9;box-shadow:0 0 0 2px rgba(4,159,217,.15)}
.btn{width:100%;padding:9px 16px;background:#049fd9;color:#fff;border:1px solid #038ab8;border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:.3px}
.btn:hover{background:#038ab8}
.err{color:#cb2938;font-size:12px;text-align:center;margin-top:12px;display:none}
.login-footer{padding:12px 24px;background:#f6f8fa;border-top:1px solid #d4d8dd;text-align:center;font-size:11px;color:#6a737d}
</style></head><body>
<div class="login-box">
<div class="login-top">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#fff"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
<h2>IoT Gateway</h2>
<p>ESP32-S3 | LoRa 433MHz | MQTT</p>
</div>
<div class="login-body">
<form onsubmit="return doLogin(this)">
<div class="fg"><label>Usuario</label><input id="lu" type="text" required autocomplete="username"></div>
<div class="fg"><label>Clave de Acceso</label><input id="lp" type="password" required autocomplete="current-password"></div>
<button class="btn" type="submit">Iniciar Sesion</button>
<div class="err" id="err">Credenciales incorrectas</div>
</form>
</div>
<div class="login-footer">Acceso restringido - Solo administradores</div>
</div>
<script>
function doLogin(f){
  var u=document.getElementById('lu').value;
  var p=document.getElementById('lp').value;
  var hash=btoa(u+':'+p);
  fetch('/api/status?__auth='+encodeURIComponent(hash)).then(function(r){
    if(r.ok){sessionStorage.setItem('auth',hash);window.location.href='/?__auth='+encodeURIComponent(hash)}
    else{document.getElementById('err').style.display='block'}
  }).catch(function(){document.getElementById('err').style.display='block'});
  return false;
}
</script>
</body></html>)rawliteral";
  server.send(200, "text/html", html);
}

// ===================== HANDLERS CON AUTH =====================

static void handle_index_auth() {
  if (!auth_check()) { handle_login_page(); return; }
  server.send_P(200, "text/html", INDEX_HTML);
}
static void handle_status_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_status();
}
static void handle_nodes_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_nodes();
}
static void handle_config_get_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_config_get();
}
static void handle_config_post_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_config_post();
}
static void handle_reboot_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_reboot();
}
static void handle_reset_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_reset();
}
static void handle_whitelist_get_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_whitelist_get();
}
static void handle_whitelist_add_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_whitelist_add();
}
static void handle_whitelist_remove_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_whitelist_remove();
}
static void handle_webcreds_post_auth() {
  if (!auth_check()) { server.send(401, "application/json", "{\"error\":\"unauthorized\"}"); return; }
  handle_webcreds_post();
}

void web_service_init() {
  config_load();
  node_store_init();

  server.on("/", HTTP_GET, handle_index_auth);
  server.on("/api/status", HTTP_GET, handle_status_auth);
  server.on("/api/nodes", HTTP_GET, handle_nodes_auth);
  server.on("/api/config", HTTP_GET, handle_config_get_auth);
  server.on("/api/config", HTTP_POST, handle_config_post_auth);
  server.on("/api/reboot", HTTP_POST, handle_reboot_auth);
  server.on("/api/reset", HTTP_POST, handle_reset_auth);
  server.on("/api/whitelist", HTTP_GET, handle_whitelist_get_auth);
  server.on("/api/whitelist/add", HTTP_POST, handle_whitelist_add_auth);
  server.on("/api/whitelist/remove", HTTP_POST, handle_whitelist_remove_auth);
  server.on("/api/webcreds", HTTP_POST, handle_webcreds_post_auth);

  server.enableCORS(true);
  server.begin();
  Serial.println("Web server iniciado en puerto " + String(WEB_PORT));
  Serial.println("Web auth: " + String(cfg_web_user) + " / " + String(cfg_web_pass));
}

void web_service_loop() {
  server.handleClient();
}

const char* web_service_get_gateway_id() {
  return cfg_gateway_id;
}
