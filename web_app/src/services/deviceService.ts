import { API_URL } from './config';

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

export const deviceService = {
  async getDevices(): Promise<Device[]> {
    const response = await fetch(`${API_URL}/devices`);
    if (!response.ok) throw new Error('Failed to fetch devices');
    return response.json();
  },

  async getDiscoveredDevices(): Promise<Partial<Device>[]> {
    const response = await fetch(`${API_URL}/devices/discovered`);
    if (!response.ok) throw new Error('Failed to fetch discovered devices');
    return response.json();
  },

  async registerDevice(device: Partial<Device>): Promise<Device> {
    const response = await fetch(`${API_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    if (!response.ok) throw new Error('Failed to register device');
    return response.json();
  },

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const response = await fetch(`${API_URL}/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update device');
    return response.json();
  },

  async getLatestTelemetry(): Promise<Record<string, any>> {
    const response = await fetch(`${API_URL}/telemetry/latest`);
    if (!response.ok) throw new Error('Failed to fetch telemetry');
    return response.json();
  },

  async deleteDevice(deviceId: string): Promise<void> {
    const response = await fetch(`${API_URL}/devices/${deviceId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete device');
  },

  async unbindDevice(deviceId: string): Promise<Device> {
    const response = await fetch(`${API_URL}/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registered: false, map_point_id: null })
    });
    if (!response.ok) throw new Error('Failed to unbind device');
    return response.json();
  },

  async getHistory(deviceId: string, range: string = '24h'): Promise<any[]> {
    const response = await fetch(`${API_URL}/telemetry/history?device_id=${deviceId}&range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  },

  async getTelemetryStats(range: string = '5m'): Promise<Record<string, any[]>> {
    const response = await fetch(`${API_URL}/telemetry/stats?range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch telemetry stats');
    return response.json();
  }
};
