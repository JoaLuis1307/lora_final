import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';

// Types matching frontend interfaces
export interface Device {
  id: number;
  device_id: string;
  name: string;
  type: string;
  status: 'Online' | 'Offline' | 'Warning' | 'Configuring' | 'online' | 'offline';
  latitude: number;
  longitude: number;
  battery_level: number;
  signal_strength: number;
  last_seen: string | null;
  mac_address?: string;
  registered?: boolean;
  map_point_id?: number | null;
  gateway_id?: string | null;
}

export interface Telemetry {
  id?: number;
  device_id: string;
  sequence: number;
  temperature: number;
  humidity: number;
  air_quality: number;
  ultrasonic_cm: number;
  tof_cm: number;
  obstacle: number;
  altitude: number;
  satellites: number;
  rssi: number;
  snr: number;
  pkts: number;
  crc_ok: number;
  crc_err: number;
  battery: number;
  battery_pct: number;
  batt_current_ma: number;
  batt_power_mw: number;
  batt_remaining_mah: number;
  batt_consumed_mah: number;
  batt_runtime_min: number;
  batt_energy_consumed_mwh: number;
  batt_energy_total_mwh: number;
  batt_low: number;
  batt_critical: number;
  timestamp: string;
}

export interface RouteData {
  id?: number;
  name: string;
  district: string;
  points: [number, number][];
  distance: number;
  duration: number;
  color?: string;
  created_at?: string;
}

export interface MapPoint {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  description?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// Bootstrapping Local Database Mock Data
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const TELEMETRY_FILE = path.join(DATA_DIR, 'telemetry.json');
const ROUTES_FILE = path.join(DATA_DIR, 'routes.json');
const MAP_POINTS_FILE = path.join(DATA_DIR, 'map_points.json');

const defaultMapPoints: MapPoint[] = [
  { id: 1, name: 'Punto Limpio Plaza Yanahuara', latitude: -16.3888, longitude: -71.5415, type: 'Reciclaje', description: 'Contenedor inteligente de vidrio y plástico', created_at: new Date().toISOString() },
  { id: 2, name: 'Contenedor Av. Ejército C-4', latitude: -16.3920, longitude: -71.5460, type: 'General', description: 'Contenedor de residuos generales de alta capacidad', created_at: new Date().toISOString() },
  { id: 3, name: 'Punto Ecológico Mall Plaza', latitude: -16.3980, longitude: -71.5520, type: 'Papel/Cartón', description: 'Contenedor inteligente para papel y cartón', created_at: new Date().toISOString() },
  { id: 4, name: 'Contenedor Calle Mercaderes', latitude: -16.3988, longitude: -71.5368, type: 'General', description: 'Ubicación central del simulador', created_at: new Date().toISOString() }
];

const defaultDevices: Device[] = [
  { id: 1, device_id: 'gateway_01', name: 'Gateway Principal LoRa', type: 'Gateway', status: 'Online', latitude: -16.3950, longitude: -71.5400, battery_level: 100, signal_strength: -40, last_seen: new Date().toISOString(), mac_address: 'AA:BB:CC:DD:EE:01', registered: true, map_point_id: null, gateway_id: null },
  { id: 2, device_id: 'gateway_02', name: 'Simulador Virtual Python', type: 'Gateway', status: 'Online', latitude: -16.3988, longitude: -71.5368, battery_level: 100, signal_strength: -30, last_seen: new Date().toISOString(), mac_address: '00:11:22:33:44:55', registered: true, map_point_id: null, gateway_id: null },
  { id: 3, device_id: 'N1', name: 'Contenedor Plaza Yanahuara', type: 'Nodo Sensor', status: 'Online', latitude: -16.3888, longitude: -71.5415, battery_level: 84, signal_strength: -75, last_seen: new Date().toISOString(), mac_address: '24:0A:C4:8B:58:AA', registered: true, map_point_id: 1, gateway_id: 'gateway_01' },
  { id: 4, device_id: 'N2', name: 'Contenedor Av. Ejército C-4', type: 'Nodo Sensor', status: 'Warning', latitude: -16.3920, longitude: -71.5460, battery_level: 42, signal_strength: -88, last_seen: new Date().toISOString(), mac_address: '24:0A:C4:8B:58:BB', registered: true, map_point_id: 2, gateway_id: 'gateway_02' }
];

const defaultTelemetry: Telemetry[] = [];
// Populate some historical telemetry for Yanahuara (N1) and Av Ejercito (N2)
for (let i = 24; i >= 0; i--) {
  const timestamp = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
  defaultTelemetry.push({
    device_id: 'N1',
    sequence: 100 - i,
    temperature: 20 + Math.sin(i / 2) * 4,
    humidity: 50 + Math.cos(i / 2) * 10,
    air_quality: 110 + Math.floor(Math.random() * 20),
    ultrasonic_cm: Math.max(10, 80 - (24 - i) * 2), // getting more full over time
    tof_cm: Math.max(10, 80 - (24 - i) * 2),
    obstacle: 0,
    altitude: 2335,
    satellites: 12,
    rssi: -70 - Math.floor(Math.random() * 8),
    snr: 8.5 + Math.random(),
    pkts: 150 - i,
    crc_ok: 1,
    crc_err: 0,
    timestamp
  });
  defaultTelemetry.push({
    device_id: 'N2',
    sequence: 200 - i,
    temperature: 22 + Math.sin(i / 2) * 5,
    humidity: 45 + Math.cos(i / 2) * 8,
    air_quality: 150 + Math.floor(Math.random() * 30),
    ultrasonic_cm: Math.max(8, 30 - (24 - i) * 0.8), // almost full!
    tof_cm: Math.max(8, 30 - (24 - i) * 0.8),
    obstacle: 1,
    altitude: 2340,
    satellites: 10,
    rssi: -85 - Math.floor(Math.random() * 5),
    snr: 5.2 + Math.random(),
    pkts: 180 - i,
    crc_ok: 1,
    crc_err: 0,
    timestamp
  });
}

const defaultRoutes: RouteData[] = [
  {
    id: 1,
    name: 'Ruta Centro - Yanahuara (Recolección Diaria)',
    district: 'Yanahuara / Cercado',
    points: [
      [-16.3988, -71.5368],
      [-16.3950, -71.5400],
      [-16.3920, -71.5460],
      [-16.3888, -71.5415],
      [-16.3988, -71.5368]
    ],
    distance: 4.5,
    duration: 18,
    color: '#2dd4bf',
    created_at: new Date().toISOString()
  }
];

function initLocalFile(filePath: string, defaultData: any) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

initLocalFile(DEVICES_FILE, defaultDevices);
initLocalFile(TELEMETRY_FILE, defaultTelemetry);
initLocalFile(ROUTES_FILE, defaultRoutes);
initLocalFile(MAP_POINTS_FILE, defaultMapPoints);

// Helper functions for reading/writing local JSON files
function readJSON(filePath: string): any[] {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function writeJSON(filePath: string, data: any[]) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// -------------------------------------------------------------
// Supabase Client Setup (if active)
// -------------------------------------------------------------
const supabase = config.db.mode === 'supabase'
  ? createClient(config.db.supabaseUrl, config.db.supabaseKey)
  : null;

// -------------------------------------------------------------
// Unified Database Interface Implementation
// -------------------------------------------------------------
export const db = {
  // === Devices API ===
  async getDevices(): Promise<Device[]> {
    if (supabase) {
      const { data, error } = await supabase.from('devices').select('*');
      if (error) throw error;
      return data || [];
    } else {
      return readJSON(DEVICES_FILE);
    }
  },

  async saveDevice(device: Partial<Device>): Promise<Device> {
    if (supabase) {
      const { data, error } = await supabase.from('devices').insert(device).select().single();
      if (error) throw error;
      return data;
    } else {
      const devices = readJSON(DEVICES_FILE);
      const newDevice: Device = {
        id: devices.length > 0 ? Math.max(...devices.map(d => d.id)) + 1 : 1,
        device_id: device.device_id || `N${devices.length + 1}`,
        name: device.name || 'Dispositivo Nuevo',
        type: device.type || 'Nodo Sensor',
        status: device.status || 'Configuring',
        latitude: device.latitude || -16.3988,
        longitude: device.longitude || -71.5368,
        battery_level: device.battery_level ?? 100,
        signal_strength: device.signal_strength ?? -50,
        last_seen: new Date().toISOString(),
        mac_address: device.mac_address || '00:00:00:00:00:00',
        registered: device.registered !== false,
        map_point_id: device.map_point_id || null,
        gateway_id: device.gateway_id || null
      };
      devices.push(newDevice);
      writeJSON(DEVICES_FILE, devices);
      return newDevice;
    }
  },

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    if (supabase) {
      const { data, error } = await supabase.from('devices').update(updates).eq('device_id', deviceId).select().single();
      if (error) throw error;
      return data;
    } else {
      const devices = readJSON(DEVICES_FILE);
      const index = devices.findIndex(d => d.device_id === deviceId);
      if (index === -1) throw new Error(`Device with ID ${deviceId} not found`);
      const updatedDevice = {
        ...devices[index],
        ...updates
      };
      devices[index] = updatedDevice;
      writeJSON(DEVICES_FILE, devices);
      return updatedDevice;
    }
  },

  async deleteDevice(deviceId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('devices').delete().eq('device_id', deviceId);
      if (error) throw error;
    } else {
      const devices = readJSON(DEVICES_FILE);
      const filtered = devices.filter(d => d.device_id !== deviceId);
      writeJSON(DEVICES_FILE, filtered);
    }
  },

  // === Telemetry API ===
  async getLatestTelemetry(): Promise<Record<string, Telemetry>> {
    if (supabase) {
      // In Postgres we'd do a select distinct on device_id ordered by timestamp desc
      const { data, error } = await supabase.rpc('get_latest_telemetry');
      if (error) {
        // Fallback if RPC is not defined in Supabase
        const { data: telemetry, error: err2 } = await supabase.from('telemetry').select('*').order('timestamp', { ascending: false });
        if (err2) throw err2;
        const latestMap: Record<string, Telemetry> = {};
        for (const t of telemetry || []) {
          if (!latestMap[t.device_id]) {
            latestMap[t.device_id] = t;
          }
        }
        return latestMap;
      }
      return data;
    } else {
      const telemetry = readJSON(TELEMETRY_FILE);
      const latestMap: Record<string, Telemetry> = {};
      for (const t of telemetry) {
        if (!latestMap[t.device_id] || new Date(t.timestamp) > new Date(latestMap[t.device_id].timestamp)) {
          latestMap[t.device_id] = t;
        }
      }
      return latestMap;
    }
  },

  async getTelemetryHistory(deviceId: string, range: string = '24h'): Promise<Telemetry[]> {
    let cutoff = new Date();
    if (range === '1h') cutoff.setHours(cutoff.getHours() - 1);
    else if (range === '6h') cutoff.setHours(cutoff.getHours() - 6);
    else if (range === '24h') cutoff.setDate(cutoff.getDate() - 1);
    else if (range === '7d') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 1); // Default to 24h

    if (supabase) {
      const { data, error } = await supabase
        .from('telemetry')
        .select('*')
        .eq('device_id', deviceId)
        .gte('timestamp', cutoff.toISOString())
        .order('timestamp', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const telemetry = readJSON(TELEMETRY_FILE);
      return telemetry
        .filter(t => t.device_id === deviceId && new Date(t.timestamp) >= cutoff)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  },

  async saveTelemetry(telemetry: Omit<Telemetry, 'id'>): Promise<Telemetry> {
    if (supabase) {
      const { data, error } = await supabase.from('telemetry').insert(telemetry).select().single();
      if (error) throw error;
      return data;
    } else {
      const telemetryList = readJSON(TELEMETRY_FILE);
      const newTelemetry: Telemetry = {
        id: telemetryList.length > 0 ? Math.max(...telemetryList.map(t => t.id || 0)) + 1 : 1,
        ...telemetry,
        timestamp: telemetry.timestamp || new Date().toISOString()
      };
      telemetryList.push(newTelemetry);
      writeJSON(TELEMETRY_FILE, telemetryList);
      return newTelemetry;
    }
  },

  // === Routes API ===
  async getRoutes(): Promise<RouteData[]> {
    if (supabase) {
      const { data, error } = await supabase.from('routes').select('*');
      if (error) throw error;
      return data || [];
    } else {
      return readJSON(ROUTES_FILE);
    }
  },

  async saveRoute(route: RouteData): Promise<RouteData> {
    if (supabase) {
      const { data, error } = await supabase.from('routes').insert(route).select().single();
      if (error) throw error;
      return data;
    } else {
      const routes = readJSON(ROUTES_FILE);
      const newRoute: RouteData = {
        id: routes.length > 0 ? Math.max(...routes.map(r => r.id || 0)) + 1 : 1,
        ...route,
        created_at: new Date().toISOString()
      };
      routes.push(newRoute);
      writeJSON(ROUTES_FILE, routes);
      return newRoute;
    }
  },

  async deleteRoute(id: number): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    } else {
      const routes = readJSON(ROUTES_FILE);
      const filtered = routes.filter(r => r.id !== id);
      writeJSON(ROUTES_FILE, filtered);
    }
  },

  // === Map Points API ===
  async getMapPoints(): Promise<MapPoint[]> {
    if (supabase) {
      const { data, error } = await supabase.from('map_points').select('*');
      if (error) throw error;
      return data || [];
    } else {
      return readJSON(MAP_POINTS_FILE);
    }
  },

  async saveMapPoint(point: Omit<MapPoint, 'id' | 'created_at'>): Promise<MapPoint> {
    if (supabase) {
      const { data, error } = await supabase.from('map_points').insert(point).select().single();
      if (error) throw error;
      return data;
    } else {
      const points = readJSON(MAP_POINTS_FILE);
      const newPoint: MapPoint = {
        id: points.length > 0 ? Math.max(...points.map(p => p.id || 0)) + 1 : 1,
        ...point,
        created_at: new Date().toISOString()
      };
      points.push(newPoint);
      writeJSON(MAP_POINTS_FILE, points);
      return newPoint;
    }
  },

  async updateMapPoint(id: number, point: Partial<MapPoint>): Promise<MapPoint> {
    if (supabase) {
      const { data, error } = await supabase.from('map_points').update(point).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const points = readJSON(MAP_POINTS_FILE);
      const index = points.findIndex(p => p.id === id);
      if (index === -1) throw new Error(`Map point with ID ${id} not found`);
      const updatedPoint = {
        ...points[index],
        ...point
      };
      points[index] = updatedPoint;
      writeJSON(MAP_POINTS_FILE, points);
      return updatedPoint;
    }
  },

  async deleteMapPoint(id: number): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('map_points').delete().eq('id', id);
      if (error) throw error;
    } else {
      const points = readJSON(MAP_POINTS_FILE);
      const filtered = points.filter(p => p.id !== id);
      writeJSON(MAP_POINTS_FILE, filtered);
    }
  }
};
