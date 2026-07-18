import React, { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Box, Paper, Typography, IconButton, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Drawer, Menu, MenuItem, ListItemIcon, ListItemText,
  ToggleButton, ToggleButtonGroup, InputAdornment,
  ClickAwayListener,
  Chip, Divider,
} from '@mui/material';
import {
  Maximize2, Minimize2, Layers, RotateCcw, Trash2, List,
  Search, X, Info, Map as MapIcon, Route, Navigation,
  Cpu, Battery, Thermometer, Droplets, Plus, Edit, Router,
  Globe, ZoomIn, ZoomOut,
  MapPin, Satellite, Moon, Sun, Lock, Unlock,
} from 'lucide-react';
import { mapService, MapPoint } from '../../../services/mapService';
import { deviceService, Device } from '../../../services/deviceService';
import { getWsUrl } from '../../../services/config';
import { calculateFillPercentage } from '../../../utils/fillCalculator';

interface MapPreviewProps {
  isPage?: boolean;
  focusVehicleId?: string | null;
}

const binsData: any[] = [];

const center: [number, number] = [-71.537, -16.409];

const PointModal: React.FC<{
  show: boolean; onClose: () => void; onSave: (e: React.FormEvent) => void;
  formData: any; setFormData: (d: any) => void; isEditing: boolean; devices: Device[];
  discoveredDevices: Partial<Device>[];
}> = ({ show, onClose, onSave, formData, setFormData, isEditing, devices, discoveredDevices }) => (
  <Dialog open={show} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ pb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.3, textTransform: 'uppercase' }}>
            {isEditing ? 'Editar Punto' : 'Vincular Hardware'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em', opacity: 0.6 }}>
            Configuración de Punto IoT
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={20} />
        </IconButton>
      </Box>
    </DialogTitle>
    <form onSubmit={onSave}>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Nombre Personalizado"
            required
            autoFocus
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Contenedor Sector A"
          />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em', color: 'text.secondary', mb: 1, display: 'block', opacity: 0.6 }}>
              Tipo de Icono en Mapa
            </Typography>
            <ToggleButtonGroup
              value={formData.type}
              exclusive
              onChange={(_, v) => v && setFormData({ ...formData, type: v })}
              fullWidth
              size="small"
            >
              {[
                { id: 'node', label: 'Nodo', icon: <Cpu size={16} /> },
                { id: 'gateway', label: 'Base', icon: <Router size={16} /> },
                { id: 'bin', label: 'Contenedor', icon: <Trash2 size={16} /> },
              ].map(t => (
                <ToggleButton key={t.id} value={t.id} sx={{ gap: 1, py: 1.5, textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 900 }}>
                  {t.icon} {t.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <TextField
            select
            label="Vincular Hardware Detectado"
            value={formData.deviceId || ''}
            onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
            slotProps={{ select: { native: true } }}
            fullWidth
            size="small"
          >
            <option value="">-- Ninguno (Sin hardware vinculado) --</option>
            <optgroup label="Dispositivos Registrados Libres">
              {devices.filter(d => d.map_point_id === null || d.map_point_id === formData.id).map(device => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id} - {device.name} ({device.type === 'Gateway' || device.type === 'gateway' ? 'Base' : 'Nodo'})
                </option>
              ))}
            </optgroup>
            <optgroup label="Hardware IoT Descubierto (No Registrado)">
              {discoveredDevices.map(device => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id} ({device.type === 'gateway' || device.type === 'Gateway' ? 'Base' : 'Nodo'})
                </option>
              ))}
            </optgroup>
          </TextField>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em', color: 'text.secondary', mb: 1, display: 'block', opacity: 0.6 }}>
              Ubicación GPS (Coordenadas)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Latitud"
                required
                type="number"
                slotProps={{ htmlInput: { step: "any" } }}
                value={formData.lat}
                onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                fullWidth
              />
              <TextField
                label="Longitud"
                required
                type="number"
                slotProps={{ htmlInput: { step: "any" } }}
                value={formData.lng}
                onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                fullWidth
              />
            </Box>
          </Box>
          <TextField
            label="Descripción / Notas"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Referencia de ubicación..."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" fullWidth>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" color="primary" fullWidth>
          {isEditing ? 'Guardar Cambios' : 'Confirmar Vínculo'}
        </Button>
      </DialogActions>
    </form>
  </Dialog>
);

const getMapStyle = (layer: string, theme: 'light' | 'dark') => {
  if (layer === 'satellite') {
    return {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri'
        }
      },
      layers: [
        { id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 19 }
      ]
    };
  }

  if (layer === 'hybrid') {
    return {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri'
        },
        'carto-labels': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© CARTO'
        }
      },
      layers: [
        { id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 19 },
        { id: 'labels-layer', type: 'raster', source: 'carto-labels', minzoom: 0, maxzoom: 19 }
      ]
    };
  }

  if (layer === 'liberty') {
    return {
      version: 8,
      sources: {
        'google-terrain': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          attribution: '© Google Maps'
        }
      },
      layers: [
        { id: 'terrain-layer', type: 'raster', source: 'google-terrain', minzoom: 0, maxzoom: 19 }
      ]
    };
  }

  const styleName = (layer === 'bright' || (layer === 'dark' && theme === 'light')) ? 'light_all' : 'dark_all';
  return {
    version: 8,
    sources: {
      'carto-tiles': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/${styleName}/{z}/{x}/{y}.png`,
          `https://b.basemaps.cartocdn.com/${styleName}/{z}/{x}/{y}.png`,
          `https://c.basemaps.cartocdn.com/${styleName}/{z}/{x}/{y}.png`,
          `https://d.basemaps.cartocdn.com/${styleName}/{z}/{x}/{y}.png`
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, © CARTO'
      }
    },
    layers: [
      { id: 'carto-layer', type: 'raster', source: 'carto-tiles', minzoom: 0, maxzoom: 19 }
    ]
  };
};

const MapPreview: React.FC<MapPreviewProps> = ({ isPage = false, focusVehicleId = null }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersCache = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLDivElement }>>(new Map());
  const hasFocusedRef = useRef<string | null>(null);

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark') as 'light' | 'dark'
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoResults, setGeoResults] = useState<any[]>([]);
  const [selectedSearchPoint, setSelectedSearchPoint] = useState<[number, number] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [routingMode, setRoutingMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const routingRef = useRef({ mode: false, points: [] as [number, number][] });
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'dark' | 'bright' | 'liberty' | 'satellite' | 'hybrid'>(() => {
    const t = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    return t === 'light' ? 'bright' : 'dark';
  });
  const [layerAnchor, setLayerAnchor] = useState<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lngLat: [number, number] } | null>(null);
  const [bearing, setBearing] = useState(-17);
  const [pitch, setPitch] = useState(45);
  const [coords, setCoords] = useState({ lat: -16.409, lng: -71.537 });
  const [dbPoints, setDbPoints] = useState<MapPoint[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [formAddData, setFormAddData] = useState<{ id?: number; name: string; description: string; type: string; lat: number; lng: number; deviceId: string }>({ name: '', description: '', type: 'node', lat: 0, lng: 0, deviceId: '' });
  const [discoveredDevices, setDiscoveredDevices] = useState<Partial<Device>[]>([]);

  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(false);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  const effectiveExpanded = isPage ? false : isExpanded;

  // Connect WebSocket for live telemetry updates
  useEffect(() => {
    const wsUrl = getWsUrl();
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      console.log(`[MAP WEBSOCKET] Conectando a ${wsUrl}...`);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[MAP WEBSOCKET] Conectado al canal de telemetría viva para el mapa.');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'telemetry' && parsed.device_id && parsed.data) {
            console.log('[MAP WEBSOCKET] Telemetría viva recibida en mapa:', parsed.device_id, parsed.data);
            setTelemetry(prev => ({
              ...prev,
              [parsed.device_id]: parsed.data
            }));
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                const fillDistance = parsed.data.tof_cm ?? parsed.data.ultrasonic_cm ?? 80;
                const fillPct = calculateFillPercentage(fillDistance);
                const status = fillPct >= 90 ? 'Warning' : 'Online';
                return { ...d, status, last_seen: new Date().toISOString() };
              }
              return d;
            }));
          }
        } catch (err) {
          console.error('[MAP WEBSOCKET] Error decodificando telemetría en mapa:', err);
        }
      };

      socket.onclose = () => {
        console.warn('[MAP WEBSOCKET] Conexión cerrada. Reintentando en 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('[MAP WEBSOCKET] Error:', err);
        socket.close();
      };
    }

    connectWS();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Theme observer
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          setCurrentTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark');
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Sync map style with theme
  useEffect(() => {
    if (activeLayer === 'bright' || activeLayer === 'dark') {
      const newLayer = currentTheme === 'light' ? 'bright' : 'dark';
      if (activeLayer !== newLayer) setActiveLayer(newLayer);
    }
  }, [currentTheme, activeLayer]);

  // Geocoding
  useEffect(() => {
    const fetchGeo = async () => {
      if (searchQuery.trim().length < 3) { setGeoResults([]); return; }
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
        setGeoResults(await res.json());
      } catch (e) { console.error(e); }
    };
    const t = setTimeout(fetchGeo, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Sync routing ref
  useEffect(() => { routingRef.current = { mode: routingMode, points: routePoints }; }, [routingMode, routePoints]);

  const loadDbPoints = useCallback(async () => {
    try { setDbPoints(await mapService.getPoints()); } catch (e) { console.error(e); }
  }, []);
  const loadDevices = useCallback(async () => {
    try { setDevices(await deviceService.getDevices()); } catch (e) { console.error(e); }
  }, []);
  const loadTelemetry = useCallback(async () => {
    try { setTelemetry(await deviceService.getLatestTelemetry()); } catch (e) { console.error(e); }
  }, []);
  const loadDiscoveredDevices = useCallback(async () => {
    try { setDiscoveredDevices(await deviceService.getDiscoveredDevices()); } catch (e) { console.error(e); }
  }, []);

  const add3DBuildings = useCallback(() => {
    if (!map.current?.loaded()) return;
    if (!map.current.getSource('openmaptiles')) return;
    const layers = map.current.getStyle().layers;
    const labelLayerId = layers?.find(l => l.type === 'symbol' && l.layout?.['text-field'])?.id;
    if (map.current.getLayer('3d-buildings')) return;
    map.current.addLayer({
      id: '3d-buildings',
      source: 'openmaptiles',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': currentTheme === 'light' ? '#cbd5e1' : '#1e293b',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_min_height']],
        'fill-extrusion-opacity': currentTheme === 'light' ? 0.7 : 0.5,
      },
    }, labelLayerId);
  }, [currentTheme]);

  const addRoutes = useCallback(() => {
    if (!map.current?.loaded()) return;
    const routes = [
      { id: 'route-north', color: '#3b82f6', coords: [[-71.545, -16.390], [-71.540, -16.395], [-71.535, -16.400], [-71.530, -16.408], [-71.525, -16.415]] },
      { id: 'route-center', color: '#10b981', coords: [[-71.537, -16.410], [-71.530, -16.415], [-71.525, -16.420], [-71.520, -16.425]] }
    ];
    routes.forEach(r => {
      if (map.current?.getSource(r.id)) return;
      map.current?.addSource(r.id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r.coords } } as any });
      map.current?.addLayer({ id: `${r.id}-glow`, type: 'line', source: r.id, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': r.color, 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 4 } });
      map.current?.addLayer({ id: r.id, type: 'line', source: r.id, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': r.color, 'line-width': 4, 'line-opacity': 0.8 } });
    });
  }, []);

  const getPopupHTML = useCallback((point: MapPoint, linkedDevice?: Device, isOnline?: boolean, deviceTelemetry?: any, isFull?: boolean, batt: number = 0) => {
    const isDark = currentTheme === 'dark';
    const bg = isDark ? '#1e1f20' : '#ffffff';
    const tc = isDark ? '#e3e3e3' : '#1f1f1f';
    const mc = isDark ? '#c4c7c5' : '#5f6368';
    const bc = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    const dividerColor = isDark ? '#3c4043' : '#e0e0e0';
    const airQuality = deviceTelemetry?.air_quality ?? deviceTelemetry?.airQuality ?? deviceTelemetry?.aq ?? 100;

    if (!linkedDevice) {
      return `
        <div style="background:${bg};border-radius:16px;padding:16px;color:${tc};min-width:240px;font-family:'Google Sans', Roboto, Arial, sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.15);border:none;display:flex;flex-direction:column;gap:6px">
          <h4 style="margin:0;font-size:14px;font-weight:700;color:${tc}">${point.name}</h4>
          <span style="font-size:10px;font-weight:700;color:#c5221f;background:rgba(217,19,14,0.08);padding:3px 8px;border-radius:100px;align-self:flex-start;text-transform:uppercase;letter-spacing:0.02em;white-space:nowrap">Sin hardware vinculado</span>
        </div>
      `;
    }

    const fillDistance = deviceTelemetry?.tof_cm ?? deviceTelemetry?.ultrasonic_cm ?? deviceTelemetry?.fill;
    let fillPct = 24;
    if (fillDistance !== undefined) {
      fillPct = calculateFillPercentage(fillDistance);
    }
    const showBinIndicator = point.type === 'bin' || point.type === 'Reciclaje' || linkedDevice?.type === 'Nodo Sensor';

    // Status Badges
    const statusDotColor = isOnline ? '#34a853' : '#5f6368';
    const statusBgColor = isOnline ? (isDark ? 'rgba(196,252,209,0.08)' : 'rgba(24,128,56,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
    const statusTextColor = isOnline ? (isDark ? '#34a853' : '#137333') : (isDark ? '#c4c7c5' : '#5f6368');

    const typeLabel = linkedDevice?.type === 'gateway' ? 'Gateway Concentrador' : 'Nodo Sensor LoRa P2P';

    // Coordinates display formatting
    const latStr = point.latitude.toFixed(5);
    const lngStr = point.longitude.toFixed(5);

    const accentColor = isFull ? '#d93025' : isOnline ? '#188038' : '#5f6f81';

    return `
      <div style="background:${bg};border-radius:16px;padding:20px;color:${tc};min-width:290px;font-family:'Google Sans', Roboto, Arial, sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.12);display:flex;flex-direction:column;gap:14px">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="padding:4px 10px;border-radius:100px;background:${statusBgColor};color:${statusTextColor};display:flex;align-items:center;gap:5px;font-weight:700;font-size:10px;letter-spacing:0.02em">
            <div style="width:5px;height:5px;border-radius:50%;background:${statusDotColor}"></div>
            <span>${isOnline ? 'EN LÍNEA' : 'DESCONECTADO'}</span>
          </div>
          ${editMode ? `
          <button onclick="window.editMapPoint(${point.id})" style="background:none;border:none;color:${tc};cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.2s" onmouseover="this.style.background='${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}'" onmouseout="this.style.background='none'" title="Editar Punto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ` : `
          <span style="font-size:9.5px;font-weight:700;color:${isDark ? '#a8c7fa' : '#1a73e8'};letter-spacing:0.05em;text-transform:uppercase">LORA ACTIVE</span>
          `}
        </div>

        <!-- Name -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <h4 style="margin:0;font-size:16px;font-weight:700;color:${tc};line-height:1.2">${point.name}</h4>
          <span style="font-size:10px;font-weight:500;color:${mc};text-transform:uppercase;letter-spacing:0.05em">${typeLabel}</span>
        </div>

        <!-- Fill level (Google Material Progress Bar) -->
        ${showBinIndicator ? `
          <div style="display:flex;flex-direction:column;gap:6px;margin:2px 0">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <span style="font-size:11px;font-weight:500;color:${mc}">Nivel de llenado</span>
              <span style="font-size:22px;font-weight:700;color:${accentColor}">${fillPct}%</span>
            </div>
            <div style="height:6px;background:${isDark ? '#3c4043' : '#f1f3f4'};border-radius:100px;overflow:hidden">
              <div style="width:${fillPct}%;height:100%;background:${accentColor};border-radius:100px;transition:width 0.4s"></div>
            </div>
          </div>` : ''}

        <!-- Parameters Grid (Google style simple table list) -->
        <div style="display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid ${dividerColor};font-size:11.5px">
          
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:${mc}">Dispositivo EUI</span>
            <span style="font-family:monospace;font-weight:700;color:${tc}">${linkedDevice?.device_id}</span>
          </div>
          
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:${mc}">Coordenadas</span>
            <span style="font-family:monospace;font-weight:700;color:${tc}">${latStr}, ${lngStr}</span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:${mc}">Batería del nodo</span>
            <span style="font-weight:700;color:${batt > 20 ? (isDark ? '#81c995' : '#137333') : '#d93025'}">${batt || 0}%</span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:${mc}">Señal LoRa P2P</span>
            <span style="font-weight:700;color:${tc}">${deviceTelemetry?.rssi ?? -70} dBm <span style="font-weight:500;opacity:0.6;font-size:10px">(SNR: ${deviceTelemetry?.snr !== undefined ? Number(deviceTelemetry.snr).toFixed(1) : '8.5'} dB)</span></span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:${mc}">Estado de sensor</span>
            <span style="font-weight:700;color:${deviceTelemetry?.obstacle === 1 ? '#d93025' : (isDark ? '#81c995' : '#137333')}">${deviceTelemetry?.obstacle === 1 ? 'Obstruido' : 'Libre (Ok)'}</span>
          </div>

        </div>

        <!-- Footer -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid ${dividerColor};font-size:9.5px;color:${mc};font-weight:500">
          <span>Última transmisión</span>
          <span>${linkedDevice?.last_seen ? new Date(linkedDevice.last_seen).toLocaleTimeString() : '---'}</span>
        </div>

      </div>`;
  }, [currentTheme, editMode]);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    const isDark = currentTheme === 'dark';
    const currentMarkerIds = new Set<string>();

    binsData.forEach(bin => {
      const id = `bin-${bin.id}`;
      currentMarkerIds.add(id);
      const cached = markersCache.current.get(id);
      const el = cached?.element || document.createElement('div');
      if (!cached) el.className = 'custom-marker';
      el.innerHTML = `<div style="background:${bin.color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 4px 12px ${bin.color}60">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </div>`;
      if (!cached) {
        const marker = new maplibregl.Marker({ element: el }).setLngLat(bin.coords)
          .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML(
            `<div style="background:${isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)'};backdrop-filter:blur(25px);border:1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'};border-radius:28px;padding:24px;color:${isDark ? '#f8fafc' : '#0f172a'};min-width:320px">
              <div style="display:flex;justify-content:space-between;margin-bottom:20px">
                <div style="padding:4px 10px;border-radius:8px;background:${bin.color}20;display:flex;align-items:center;gap:6px">
                  <div style="width:6px;height:6px;border-radius:50%;background:${bin.color};box-shadow:0 0 10px ${bin.color}"></div>
                  <span style="font-size:10px;font-weight:900;color:${bin.color};text-transform:uppercase">${bin.status}</span>
                </div>
              </div>
              <h4 style="margin:0 0 4px;font-size:22px;font-weight:900">${bin.name}</h4>
              <div style="background:${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};padding:20px;border-radius:22px;border:1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'};margin-top:20px">
                <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                  <span style="font-size:10px;font-weight:800;color:${isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)'};text-transform:uppercase">Capacidad Actual</span>
                  <span style="font-size:32px;font-weight:900;color:${bin.color}">${bin.level}<span style="font-size:16px;opacity:0.6">%</span></span>
                </div>
                <div style="height:12px;background:${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};border-radius:20px;overflow:hidden">
                  <div style="width:${bin.level}%;height:100%;background:linear-gradient(90deg,${bin.color},${bin.color}dd);border-radius:20px;box-shadow:0 0 20px ${bin.color}40"></div>
                </div>
              </div>
            </div>`
          )).addTo(map.current!);
        markersCache.current.set(id, { marker, element: el });
      } else {
        cached.marker.setLngLat(bin.coords);
      }
    });

    dbPoints.forEach(point => {
      const id = `point-${point.id}`;
      currentMarkerIds.add(id);
      const linkedDevice = devices.find(d => d.map_point_id === point.id);
      const isOnline = linkedDevice?.status?.toLowerCase() === 'online';
      const dt = linkedDevice ? telemetry[linkedDevice.device_id] : null;

      const fillDistance = dt?.tof_cm ?? dt?.ultrasonic_cm ?? dt?.fill;
      let fillPct = 24;
      if (fillDistance !== undefined) {
        fillPct = calculateFillPercentage(fillDistance);
      }
      const isFull = fillPct >= 90 || dt?.is_full === 1;
      const batt = dt?.battery ?? dt?.battery_level ?? linkedDevice?.battery_level ?? 0;
      const cached = markersCache.current.get(id);
      const el = cached?.element || document.createElement('div');
      if (!cached) el.className = 'db-marker';

      let iconSvg = '';
      if (point.type === 'gateway') {
        iconSvg = '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-2-4-2.2c-.5.2-2 .6-4 2.2s-3 3.5-3 5.5a7 7 0 0 0 7 7z"/><path d="M12 18V12"/><path d="M12 12s2-2 2-4-2-4-2-4-2 2-2 4 2 4 2 4z"/>';
      } else {
        // Tachos de basura (Trash2 icon)
        iconSvg = '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
      }

      const markerColor = linkedDevice
        ? (isFull ? '#ef4444' : isOnline ? '#10b981' : isDark ? '#334155' : '#94a3b8')
        : '#3b82f6';
      
      const markerBorder = '2.5px solid white';
      const markerShadow = `0 4px 12px ${markerColor}60`;

      el.innerHTML = `<div style="background:${markerColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:${markerBorder};box-shadow:${markerShadow};position:relative">
        ${isFull ? `
          <div style="position:absolute;width:100%;height:100%;border-radius:50%;animation:subtle-ripple 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;pointer-events:none;z-index:-1"></div>
          <div style="position:absolute;width:100%;height:100%;border-radius:50%;animation:subtle-ripple 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;animation-delay:0.8s;pointer-events:none;z-index:-1"></div>
          <div style="position:absolute;width:100%;height:100%;border-radius:50%;animation:subtle-ripple 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;animation-delay:1.6s;pointer-events:none;z-index:-1"></div>
        ` : ''}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">${iconSvg}</svg>
        ${linkedDevice && isOnline && !isFull ? '<div style="position:absolute;top:-1px;right:-1px;width:9px;height:9px;background:#10b981;border:2px solid white;border-radius:50%;animation:pulse 2s infinite"></div>' : ''}
      </div>`;

      if (!cached) {
        const marker = new maplibregl.Marker({ element: el }).setLngLat([point.longitude, point.latitude])
          .setPopup(new maplibregl.Popup({ offset: 25, maxWidth: 'none' }).setHTML(getPopupHTML(point, linkedDevice, isOnline, dt, isFull, batt)))
          .addTo(map.current!);
        markersCache.current.set(id, { marker, element: el });
      } else {
        cached.marker.setLngLat([point.longitude, point.latitude]);
        if (cached.marker.getPopup().isOpen()) cached.marker.getPopup().setHTML(getPopupHTML(point, linkedDevice, isOnline, dt, isFull, batt));
      }
    });

    if (selectedSearchPoint) {
      const id = 'search-point';
      currentMarkerIds.add(id);
      const cached = markersCache.current.get(id);
      const el = cached?.element || document.createElement('div');
      el.innerHTML = `<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 0 20px rgba(239,68,68,0.6);animation:pulse 2s infinite">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`;
      if (!cached) {
        const marker = new maplibregl.Marker({ element: el }).setLngLat(selectedSearchPoint).addTo(map.current!);
        markersCache.current.set(id, { marker, element: el });
      } else cached.marker.setLngLat(selectedSearchPoint);
    }

    markersCache.current.forEach((v, id) => { if (!currentMarkerIds.has(id)) { v.marker.remove(); markersCache.current.delete(id); } });
  }, [dbPoints, devices, telemetry, currentTheme, selectedSearchPoint, getPopupHTML, editMode]);



  const handleMapClick = (e: any) => {
    if (routingRef.current.mode) {
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const pts = [...routingRef.current.points, c];
      setRoutePoints(pts);
      if (pts.length >= 2) calculateRoute(pts);
      return;
    }
  };

  const focusOnBin = (coords: [number, number]) => map.current?.flyTo({ center: coords, zoom: 17, pitch: 45, essential: true, duration: 2000 });

  const resetView = () => { setViewMode('3D'); map.current?.flyTo({ center, zoom: 14, pitch: 45, bearing: -17, essential: true }); };

  const refreshRouteLayer = useCallback(() => {
    if (!map.current || !routeData) return;
    const geometry = routeData.geometry;
    if (map.current.getSource('active-route')) { (map.current.getSource('active-route') as any).setData(geometry); }
    else {
      map.current.addSource('active-route', { type: 'geojson', data: geometry });
      map.current.addLayer({ id: 'route-line-bg', type: 'line', source: 'active-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 8, 'line-opacity': 0.3 } });
      map.current.addLayer({ id: 'route-line', type: 'line', source: 'active-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#60a5fa', 'line-width': 4, 'line-opacity': 0.8 } });
    }
    if (map.current.getLayer('route-line-bg')) map.current.moveLayer('route-line-bg');
    if (map.current.getLayer('route-line')) map.current.moveLayer('route-line');
  }, [routeData]);

  const calculateRoute = async (points: [number, number][]) => {
    if (points.length < 2) return;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${points.map(p => `${p[0]},${p[1]}`).join(';')}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.code === 'Ok') setRouteData({ distance: (data.routes[0].distance / 1000).toFixed(2), duration: Math.round(data.routes[0].duration / 60), geometry: data.routes[0].geometry });
    } catch (e) { console.error(e); }
  };

  const handleOpenAddModal = (lngLat: [number, number]) => {
    if (!editMode) return;
    setEditingPointId(null);
    setFormAddData({ name: '', description: '', type: 'node', lat: lngLat[1], lng: lngLat[0], deviceId: '' });
    loadDiscoveredDevices();
    setShowAddModal(true);
    setContextMenu(null);
  };

  const handleSaveNewPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMode) return;
    try {
      if (editingPointId) {
        // 1. Update Map Point details
        await mapService.updatePoint(editingPointId, {
          name: formAddData.name,
          latitude: formAddData.lat,
          longitude: formAddData.lng,
          type: formAddData.type,
          description: formAddData.description
        });

        // 2. Manage device association
        const oldDevice = devices.find(d => d.map_point_id === editingPointId);

        // If the linked device ID has changed:
        if (oldDevice?.device_id !== formAddData.deviceId) {
          // Unlink the old device
          if (oldDevice) {
            await deviceService.updateDevice(oldDevice.device_id, { map_point_id: null });
          }
          // Link the new device
          if (formAddData.deviceId) {
            const isRegisteredInDb = devices.some(d => d.device_id === formAddData.deviceId);
            const devType = formAddData.type === 'bin' ? 'Nodo Sensor' : (formAddData.type === 'gateway' ? 'Gateway' : 'Nodo Sensor');
            if (isRegisteredInDb) {
              await deviceService.updateDevice(formAddData.deviceId, {
                map_point_id: editingPointId,
                name: formAddData.name,
                latitude: formAddData.lat,
                longitude: formAddData.lng,
                type: devType
              });
            } else {
              await deviceService.registerDevice({
                device_id: formAddData.deviceId,
                map_point_id: editingPointId,
                name: formAddData.name,
                latitude: formAddData.lat,
                longitude: formAddData.lng,
                type: devType,
                registered: true
              });
            }
          }
        } else if (oldDevice && formAddData.deviceId) {
          // Device did not change, but update metadata
          const devType = formAddData.type === 'bin' ? 'Nodo Sensor' : (formAddData.type === 'gateway' ? 'Gateway' : 'Nodo Sensor');
          await deviceService.updateDevice(formAddData.deviceId, {
            name: formAddData.name,
            latitude: formAddData.lat,
            longitude: formAddData.lng,
            type: devType
          });
        }
      } else {
        const np = await mapService.savePoint({
          name: formAddData.name || 'Nuevo Punto',
          latitude: formAddData.lat,
          longitude: formAddData.lng,
          type: formAddData.type,
          description: formAddData.description
        });
        if (formAddData.deviceId) {
          const isRegisteredInDb = devices.some(d => d.device_id === formAddData.deviceId);
          const devType = formAddData.type === 'bin' ? 'Nodo Sensor' : (formAddData.type === 'gateway' ? 'Gateway' : 'Nodo Sensor');
          if (isRegisteredInDb) {
            await deviceService.updateDevice(formAddData.deviceId, {
              map_point_id: np.id,
              name: formAddData.name,
              latitude: formAddData.lat,
              longitude: formAddData.lng,
              type: devType
            });
          } else {
            await deviceService.registerDevice({
              device_id: formAddData.deviceId,
              map_point_id: np.id,
              name: formAddData.name,
              latitude: formAddData.lat,
              longitude: formAddData.lng,
              type: devType,
              registered: true
            });
          }
        }
      }
      setShowAddModal(false);
      setEditingPointId(null);
      loadDbPoints(); loadDevices(); loadTelemetry(); loadDiscoveredDevices();
    } catch (err) {
      console.error(err);
      alert('Error al procesar el punto');
    }
  };

  const handleDeletePoint = async (id: number) => {
    if (!editMode) return;
    try { await mapService.deletePoint(id); setDbPoints(prev => prev.filter(p => p.id !== id)); loadDevices(); }
    catch { alert('Error al eliminar'); }
  };

  useEffect(() => {
    (window as any).editMapPoint = (id: number) => {
      if (!editModeRef.current) return;
      const point = dbPoints.find(p => p.id === id);
      if (point) {
        const device = devices.find(d => d.map_point_id === point.id);
        setEditingPointId(point.id!);
        setFormAddData({ id: point.id, name: point.name, description: point.description || '', type: point.type || 'node', lat: point.latitude, lng: point.longitude, deviceId: device?.device_id || '' });
        loadDiscoveredDevices();
        setShowAddModal(true);
      }
    };
  }, [dbPoints, devices, loadDiscoveredDevices]);

  // Trigger edit modal if query params specify it
  useEffect(() => {
    if (devices.length === 0 || dbPoints.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editDeviceId = params.get('deviceId');
    const triggerEdit = params.get('edit') === 'true';
    if (triggerEdit && editDeviceId) {
      const linkedDevice = devices.find(d => d.device_id === editDeviceId);
      
      // Clean URL params to prevent re-triggering
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url.toString());
      
      // Enable edit mode first
      setEditMode(true);
      editModeRef.current = true;
      
      if (linkedDevice) {
        if (linkedDevice.map_point_id) {
          // Trigger the edit handler!
          (window as any).editMapPoint(linkedDevice.map_point_id);
        } else {
          // If no map point is linked yet, open add modal to register and place it
          setEditingPointId(null);
          setFormAddData({
            name: linkedDevice.name || `Contenedor ${linkedDevice.device_id}`,
            description: 'Ubicación registrada',
            type: linkedDevice.type === 'Gateway' || linkedDevice.type === 'gateway' ? 'gateway' : 'bin',
            lat: linkedDevice.latitude || center[1],
            lng: linkedDevice.longitude || center[0],
            deviceId: linkedDevice.device_id
          });
          loadDiscoveredDevices();
          setShowAddModal(true);
        }
      }
    }
  }, [devices, dbPoints, loadDiscoveredDevices]);

  // Map initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(activeLayer, currentTheme) as any,
      center, zoom: 14, maxZoom: 19, pitch: 45, bearing: -17, attributionControl: false,
    });
    const onStyleLoad = () => { 
      setMapLoaded(true);
      add3DBuildings(); 
      addRoutes(); 
      addMarkers(); 
      loadDbPoints(); 
      refreshRouteLayer(); 
    };
    map.current.on('style.load', onStyleLoad);
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat'), lng = params.get('lng'), zoom = params.get('zoom');
    if (lat && lng) {
      const targetCenter: [number, number] = [parseFloat(lng!), parseFloat(lat!)];
      const targetZoom = zoom ? parseFloat(zoom) : 17;
      const fly = () => {
        map.current?.flyTo({
          center: targetCenter,
          zoom: targetZoom,
          pitch: 45,
          essential: true,
          duration: 2000
        });
      };
      if (map.current.loaded()) {
        fly();
      } else {
        map.current.on('load', fly);
      }
    }
    map.current.on('click', handleMapClick);
    map.current.on('rotate', () => setBearing(map.current?.getBearing() || 0));
    map.current.on('pitch', () => setPitch(map.current?.getPitch() || 0));
    map.current.on('move', () => { const c = map.current?.getCenter(); if (c) setCoords({ lat: c.lat, lng: c.lng }); });
    map.current.on('contextmenu', (e) => {
      e.preventDefault();
      if (editModeRef.current) {
        setContextMenu({ x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat] });
      }
    });
    return () => { 
      map.current?.remove(); 
      map.current = null; 
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mapLoaded) addMarkers(); }, [dbPoints, devices, telemetry, addMarkers, currentTheme, editMode, mapLoaded]);
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const targetStyle = getMapStyle(activeLayer, currentTheme) as any;
    map.current.setStyle(targetStyle);
  }, [activeLayer, currentTheme, mapLoaded]);
  useEffect(() => { map.current?.flyTo({ pitch: viewMode === '2D' ? 0 : 45, bearing: viewMode === '2D' ? 0 : -17, duration: 1000 }); }, [viewMode]);
  useEffect(() => { if (showAddModal) return; loadDbPoints(); loadDevices(); loadTelemetry(); loadDiscoveredDevices(); const i = setInterval(() => { loadDbPoints(); loadDevices(); loadTelemetry(); loadDiscoveredDevices(); }, 5000); return () => clearInterval(i); }, [loadDbPoints, loadDevices, loadTelemetry, loadDiscoveredDevices, showAddModal]);
  useEffect(() => { const h = () => map.current?.resize(); window.addEventListener('resize', h); const t = setTimeout(h, 500); return () => { window.removeEventListener('resize', h); clearTimeout(t); }; }, [isExpanded]);



  const searchResults = searchQuery.trim().length > 0 ? [
    ...binsData.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.id.toLowerCase().includes(searchQuery.toLowerCase())).map(b => ({ ...b, type: 'bin' as const })),
    ...dbPoints.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => ({ ...p, type: 'db' as const })),
    ...geoResults.map(g => ({ id: g.place_id, name: g.display_name, lat: parseFloat(g.lat), lng: parseFloat(g.lng), type: 'geo' as const })),
  ].slice(0, 6) : [];

  return (
      <Box
        sx={{
          width: '100%', overflow: 'hidden', position: 'relative',
          height: effectiveExpanded ? 'calc(100vh - 64px)' : isPage ? '100%' : 800,
          bgcolor: 'background.default',
          ...(effectiveExpanded ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: 'var(--sidebar-width)', zIndex: 50 } : {}),
        }}
      >
        <style>{`
          @keyframes subtle-ripple {
            0% {
              transform: scale(0.9);
              background-color: rgba(239, 68, 68, 0.5);
            }
            100% {
              transform: scale(4.2);
              background-color: rgba(239, 68, 68, 0);
            }
          }
        `}</style>

        {/* Map Container */}
        <Box ref={mapContainer} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Context Menu */}
        <Menu
          open={Boolean(contextMenu)}
          onClose={() => setContextMenu(null)}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu ? { top: contextMenu.y + 8, left: contextMenu.x + 8 } : undefined}
          sx={{ '& .MuiPaper-root': { minWidth: 200, borderRadius: 3, backdropFilter: 'blur(24px)' } }}
        >
          <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', opacity: 0.6 }}>
            Opciones de Mapa
          </Typography>
          <Divider />
          <MenuItem onClick={() => { if (contextMenu) handleOpenAddModal(contextMenu.lngLat); }}>
            <ListItemIcon><Plus size={16} /></ListItemIcon>
            <ListItemText>Registrar Nuevo Punto</ListItemText>
          </MenuItem>
        </Menu>

        {/* Right Info Panel - Google Maps style Drawer */}
        <Drawer
          anchor="right"
          open={showNetworkPanel}
          onClose={() => setShowNetworkPanel(false)}
          variant="persistent"
          sx={{
            '& .MuiDrawer-paper': {
              width: 340, top: 0, right: 0, height: '100%',
              bgcolor: 'var(--bg-sidebar)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: 'none',
              borderLeft: 'none',
              boxShadow: 'none',
              pt: 1,
            },
          }}
        >
          <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', lineHeight: 1.2, mb: 0.25 }}>
                Estado de Red
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Telemetría en Vivo
              </Typography>
            </Box>
            <IconButton onClick={() => setShowNetworkPanel(false)} size="small" sx={{ bgcolor: 'action.hover', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <X size={16} />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>


            {dbPoints.map((point) => {
              const linkedDevice = devices.find(d => d.map_point_id === point.id);
              const isOnline = linkedDevice?.status?.toLowerCase() === 'online';
              const dt = linkedDevice ? telemetry[linkedDevice.device_id] : null;
              const battery = dt?.battery ?? linkedDevice?.battery_level ?? 85;
              const fillDistance = dt?.tof_cm ?? dt?.ultrasonic_cm;
              const fillLevel = fillDistance !== undefined ? calculateFillPercentage(fillDistance) : (dt?.fill_level ?? 0);
              const isFull = fillLevel >= 90 || dt?.is_full === 1;
              const rssi = dt?.rssi ?? dt?.signal_strength ?? -85;
              const fillCol = fillLevel >= 90 ? 'error.main' : fillLevel >= 75 ? 'warning.main' : 'success.main';

              return (
                <Paper
                  key={point.id}
                  onClick={() => focusOnBin([point.longitude, point.latitude])}
                  sx={{ 
                    p: 2, 
                    borderRadius: '12px',
                    cursor: 'pointer', 
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
                    border: 'none',
                    boxShadow: 'none',
                    position: 'relative',
                    transition: 'all 0.15s',
                    '&:hover': { 
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.045)'
                    } 
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isOnline ? 'success.main' : 'text.secondary', animation: isOnline ? 'pulse 2s infinite' : 'none' }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.05em', color: 'text.secondary', textTransform: 'uppercase', fontSize: 9.5 }}>
                          {point.type || 'Sensor'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>{point.name}</Typography>
                    </Box>
                    {linkedDevice && (
                      <Chip 
                        icon={<Battery size={11} />} 
                        label={`${battery}%`} 
                        size="small" 
                        sx={{ 
                          fontWeight: 800, 
                          height: 20, 
                          fontSize: 10,
                          bgcolor: battery < 20 ? 'rgba(217,48,37,0.08)' : 'rgba(24,128,56,0.08)',
                          color: battery < 20 ? '#d93025' : '#188038',
                          border: 'none',
                          '& .MuiChip-icon': { color: 'inherit' }
                        }} 
                      />
                    )}
                  </Box>

                  {linkedDevice ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {/* Capacity progress bar instead of temp/hum */}
                      {point.type === 'bin' && (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: 9 }}>Capacidad</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 900, fontFamily: 'monospace', color: fillCol, fontSize: 11.5 }}>{fillLevel}%</Typography>
                          </Box>
                          <Box sx={{ height: 5, bgcolor: 'action.hover', borderRadius: 10, overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${fillLevel}%`, bgcolor: fillCol }} />
                          </Box>
                        </Box>
                      )}
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.25, height: 12 }}>
                            {[1, 2, 3, 4].map(b => (
                              <Box key={b} sx={{ width: 2.5, borderRadius: '1px 1px 0 0', height: `${b * 25}%`, bgcolor: b <= (rssi > -60 ? 4 : rssi > -75 ? 3 : rssi > -85 ? 2 : 1) ? (rssi <= -85 ? 'error.main' : rssi <= -75 ? 'warning.main' : 'success.main') : 'rgba(255,255,255,0.08)' }} />
                            ))}
                          </Box>
                          <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.65rem', fontFamily: 'monospace' }}>{rssi} dBm</Typography>
                        </Box>
                        {isFull && (
                          <Chip 
                            label="CRÍTICO" 
                            size="small" 
                            sx={{ 
                              height: 18, 
                              fontSize: 8.5, 
                              fontWeight: 900, 
                              bgcolor: 'rgba(217,48,37,0.08)', 
                              color: '#d93025', 
                              border: 'none' 
                            }} 
                          />
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', opacity: 0.5, fontStyle: 'italic', display: 'block', textAlign: 'center', py: 0.5 }}>
                      Sin hardware vinculado
                    </Typography>
                  )}
                  {editMode && (
                    <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, opacity: 0, transition: '0.2s', '&:hover': { opacity: 1 } }}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditingPointId(point.id!); setFormAddData({ id: point.id, name: point.name, description: point.description || '', type: point.type || 'node', lat: point.latitude, lng: point.longitude, deviceId: linkedDevice?.device_id || '' }); loadDiscoveredDevices(); setShowAddModal(true); }} sx={{ width: 28, height: 28, borderRadius: 2, bgcolor: 'rgba(45,212,191,0.15)' }}>
                        <Edit size={12} />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar este punto?')) handleDeletePoint(point.id!); }} sx={{ width: 28, height: 28, borderRadius: 2, bgcolor: 'rgba(251,113,133,0.15)' }}>
                        <Trash2 size={12} />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
              );
            })}
            {binsData.sort((a, b) => b.level - a.level).map(bin => (
              <Paper
                key={bin.id}
                onClick={() => focusOnBin(bin.coords)}
                sx={{ p: 2, borderRadius: 3, cursor: 'pointer', transition: '0.2s' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: bin.color, boxShadow: `0 0 8px ${bin.color}` }} />
                      {bin.id}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>{bin.name}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 900, color: bin.color }}>{bin.level}%</Typography>
                </Box>
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden', mt: 1 }}>
                  <Box sx={{ height: '100%', borderRadius: 3, bgcolor: bin.color, width: `${bin.level}%`, transition: 'width 1s' }} />
                </Box>
              </Paper>
            ))}
          </Box>
          <Box sx={{ p: 2 }}>
            <Button 
              fullWidth 
              onClick={resetView} 
              startIcon={<RotateCcw size={14} />} 
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 700, 
                borderRadius: '24px', 
                py: 1,
                border: 'none',
                textTransform: 'none',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.065)',
                }
              }}
            >
              Restablecer Cámara
            </Button>
          </Box>
        </Drawer>

        {/* Controls - Bottom Right (Waze style) */}
        <Box sx={{ position: 'absolute', bottom: 24, right: 24, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <IconButton onClick={() => map.current?.zoomIn()} sx={{ borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(24px)', '&:hover': { bgcolor: 'action.hover' } }}>
            <ZoomIn size={20} />
          </IconButton>
          <IconButton onClick={() => map.current?.zoomOut()} sx={{ borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(24px)', '&:hover': { bgcolor: 'action.hover' } }}>
            <ZoomOut size={20} />
          </IconButton>
          <Box sx={{ height: 1, bgcolor: 'divider', mx: 1 }} />
          <IconButton
            onClick={(e) => setLayerAnchor(e.currentTarget)}
            sx={{ borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(24px)', color: layerAnchor ? 'primary.main' : 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Layers size={20} />
          </IconButton>
          <IconButton
            onClick={() => setActiveLayer(activeLayer === 'hybrid' ? (currentTheme === 'light' ? 'bright' : 'dark') : 'hybrid')}
            sx={{ borderRadius: 2, bgcolor: activeLayer === 'hybrid' ? 'rgba(45,212,191,0.15)' : 'background.paper', color: activeLayer === 'hybrid' ? 'primary.main' : 'text.secondary', backdropFilter: 'blur(24px)' }}
          >
            <Globe size={20} />
          </IconButton>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            sx={{ bgcolor: 'background.paper', backdropFilter: 'blur(24px)', '& .MuiToggleButton-root': { border: 'none', px: 1.5, py: 1, fontWeight: 900, fontSize: '0.6rem' } }}
          >
            <ToggleButton value="3D">3D</ToggleButton>
            <ToggleButton value="2D">2D</ToggleButton>
          </ToggleButtonGroup>
          <IconButton
            onClick={() => { setRoutingMode(!routingMode); setRoutePoints([]); setRouteData(null); if (map.current?.getSource('active-route')) (map.current.getSource('active-route') as any).setData({ type: 'FeatureCollection', features: [] }); }}
            sx={{ borderRadius: 2, bgcolor: routingMode ? 'rgba(59,130,246,0.15)' : 'background.paper', color: routingMode ? '#3b82f6' : 'text.secondary', backdropFilter: 'blur(24px)' }}
          >
            <Route size={20} />
          </IconButton>
          {!isPage && (
            <IconButton onClick={() => setIsExpanded(!isExpanded)} sx={{ borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(24px)' }}>
              {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </IconButton>
          )}
        </Box>

        {/* Layer Menu */}
        <Menu anchorEl={layerAnchor} open={Boolean(layerAnchor)} onClose={() => setLayerAnchor(null)} sx={{ '& .MuiPaper-root': { minWidth: 180, borderRadius: 3 } }}>
          {[
            { id: 'dark', label: 'Modo Noche', icon: <Moon size={16} /> },
            { id: 'satellite', label: 'Satélite Puro', icon: <Satellite size={16} /> },
            { id: 'hybrid', label: 'Híbrido 3D', icon: <Globe size={16} /> },
            { id: 'bright', label: 'Modo Claro', icon: <Sun size={16} /> },
            { id: 'liberty', label: 'Terreno', icon: <MapIcon size={16} /> },
          ].map(l => (
            <MenuItem key={l.id} selected={activeLayer === l.id} onClick={() => { setActiveLayer(l.id as any); setLayerAnchor(null); }}>
              <ListItemIcon>{l.icon}</ListItemIcon>
              <ListItemText>{l.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        {/* Top-left Control Buttons */}
        <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <IconButton
            onClick={() => setShowNetworkPanel(!showNetworkPanel)}
            sx={{ borderRadius: 2, bgcolor: showNetworkPanel ? 'rgba(45,212,191,0.15)' : 'background.paper', color: showNetworkPanel ? 'primary.main' : 'text.secondary', backdropFilter: 'blur(24px)' }}
            title={showNetworkPanel ? "Ocultar Panel de Red" : "Mostrar Panel de Red"}
          >
            <List size={20} />
          </IconButton>
          <IconButton
            onClick={() => setEditMode(!editMode)}
            sx={{
              borderRadius: 2,
              bgcolor: editMode ? 'rgba(239, 68, 68, 0.15)' : 'background.paper',
              color: editMode ? 'error.main' : 'text.secondary',
              backdropFilter: 'blur(24px)',
              border: editMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                bgcolor: editMode ? 'rgba(239, 68, 68, 0.25)' : 'action.hover',
              }
            }}
            title={editMode ? "Desactivar Modo Edición" : "Activar Modo Edición"}
          >
            {editMode ? <Unlock size={20} /> : <Lock size={20} />}
          </IconButton>
        </Box>

        {/* Compass - Bottom Left (Google Maps style) */}
        <Box sx={{ position: 'absolute', bottom: 24, left: 24, zIndex: 10 }}>
          <IconButton
            onClick={() => { map.current?.rotateTo(0, { duration: 1000 }); map.current?.setPitch(45); }}
            sx={{
              width: 56, height: 56, borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(24px)',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" sx={{ position: 'absolute', top: 4, fontWeight: 900, color: 'error.main', fontSize: '0.5rem' }}>N</Typography>
              <Box sx={{ width: 2, height: 28, background: `linear-gradient(to top, transparent, ${currentTheme === 'dark' ? '#2dd4bf' : '#0d9488'}, ${currentTheme === 'dark' ? '#fb7185' : '#e11d48'})`, borderRadius: 2 }} />
            </Box>
          </IconButton>
        </Box>

        {/* Coordinates - Bottom Left */}
        <Box sx={{ position: 'absolute', bottom: 88, left: 24, zIndex: 10 }}>
          <Paper sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.55rem', color: 'text.secondary', display: 'block' }}>
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </Typography>
          </Paper>
        </Box>

        {/* Search Bar - Bottom Center (Waze style) */}
        <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: '100%', maxWidth: 480, px: 2 }}>
          <ClickAwayListener onClickAway={() => setSearchOpen(false)}>
            <Box ref={searchRef}>
              {searchOpen && searchResults.length > 0 && (
                <Paper sx={{ mb: 1, borderRadius: 3, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
                  {searchResults.map((result, idx) => {
                    const isBin = result.type === 'bin';
                    const isGeo = result.type === 'geo';
                    return (
                      <MenuItem
                        key={`${result.type}-${result.id}-${idx}`}
                        onClick={() => {
                          if (isGeo) { const g = result as any; const c: [number, number] = [g.lng, g.lat]; setSelectedSearchPoint(c); map.current?.flyTo({ center: c, zoom: 15, duration: 2000 }); }
                          else { focusOnBin(isBin ? (result as any).coords : [(result as any).longitude, (result as any).latitude]); setSelectedSearchPoint(null); }
                          setSearchQuery(''); setSearchOpen(false);
                        }}
                        divider
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Paper sx={{ p: 0.5, borderRadius: 1, bgcolor: 'rgba(45,212,191,0.1)', color: 'primary.main' }}>
                            {isBin ? <MapIcon size={14} /> : isGeo ? <Globe size={14} /> : <Info size={14} />}
                          </Paper>
                        </ListItemIcon>
                        <ListItemText
                          primary={result.name}
                          secondary={isBin ? 'Contenedor' : isGeo ? 'Ubicación' : 'Punto Registrado'}
                          slotProps={{ primary: { sx: { fontWeight: 700, fontSize: '0.8rem' } }, secondary: { sx: { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' } } }}
                        />
                        <Chip label="Explorar" size="small" sx={{ fontWeight: 800, color: 'primary.main', bgcolor: 'rgba(45,212,191,0.1)' }} />
                      </MenuItem>
                    );
                  })}
                </Paper>
              )}
              <TextField
                fullWidth
                placeholder="Buscar dispositivos, contenedores o zonas..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><Search size={18} style={{ opacity: 0.5 }} /></InputAdornment>,
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => { setSearchQuery(''); setSelectedSearchPoint(null); }}>
                          <X size={16} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, py: 0.5 } }}
              />
            </Box>
          </ClickAwayListener>
        </Box>

        {/* Route Stats Overlay */}
        {routeData && (
          <Paper sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, px: 4, py: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(45,212,191,0.12)', color: 'primary.main' }}>
                <Navigation size={20} style={{ animation: 'pulse 2s infinite' }} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', opacity: 0.5 }}>Distancia</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>{routeData.distance} <Typography component="span" variant="caption" sx={{ opacity: 0.5 }}>km</Typography></Typography>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', opacity: 0.5 }}>Tiempo Est.</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>{routeData.duration} <Typography component="span" variant="caption" sx={{ opacity: 0.5 }}>min</Typography></Typography>
            </Box>
            <IconButton size="small" onClick={() => { setRoutePoints([]); setRouteData(null); if (map.current?.getSource('active-route')) (map.current.getSource('active-route') as any).setData({ type: 'FeatureCollection', features: [] }); }} sx={{ color: 'error.main' }}>
              <X size={18} />
            </IconButton>
          </Paper>
        )}

        {/* Routing Instructions */}
        {routingMode && !routeData && (
          <Paper sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, px: 3, py: 1.5, borderRadius: 4, bgcolor: 'primary.main', color: '#fff' }}>
            <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapPin size={14} />
              {routePoints.length === 0 ? 'Selecciona punto de origen' : `Añadir punto #${routePoints.length + 1} o cerrar`}
            </Typography>
          </Paper>
        )}

        {/* Point Modal */}
        <PointModal
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveNewPoint}
          formData={formAddData}
          setFormData={setFormAddData}
          isEditing={!!editingPointId}
          devices={devices}
          discoveredDevices={discoveredDevices}
        />
      </Box>
  );
};



export default MapPreview;
