import { API_URL } from './config';

export interface VehicleData {
  id: string;
  plate: string;
  driver: string;
  status: 'In Route' | 'Maintenance' | 'Available' | 'Low Fuel';
  fuel: number;
  capacity: number;
  location: string;
  last_update: string;
  speed: number;
}

export interface RealtimeVehicle {
  id: string;
  nombre: string;
  capacidad: number;
  velocidad: number;
  estado: string;
  coordenada: { lat: number; lng: number };
  coordenada_raw: string;
}

export interface MaintenanceLogData {
  id?: number;
  vehicle_id: string;
  description: string;
  cost?: number;
  severity: 'error' | 'warning' | 'info';
  date?: string;
}

export const fleetService = {
  async getVehicles(): Promise<VehicleData[]> {
    const response = await fetch(`${API_URL}/fleet/vehicles`);
    if (!response.ok) throw new Error('Failed to fetch vehicles');
    return response.json();
  },

  async getRealtimeFleet(): Promise<RealtimeVehicle[]> {
    const response = await fetch(`${API_URL}/fleet/realtime`);
    if (!response.ok) throw new Error('Failed to fetch realtime fleet');
    const data = await response.json();
    // API may return array directly or wrapped { value: [...] }
    return Array.isArray(data) ? data : (data.value ?? []);
  },

  async saveVehicle(vehicle: Partial<VehicleData>): Promise<VehicleData> {
    const response = await fetch(`${API_URL}/fleet/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle),
    });
    if (!response.ok) throw new Error('Failed to save vehicle');
    return response.json();
  },

  async updateVehicle(vehicleId: string, updates: Partial<VehicleData>): Promise<VehicleData> {
    const response = await fetch(`${API_URL}/fleet/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update vehicle');
    return response.json();
  },

  async deleteVehicle(vehicleId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/fleet/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete vehicle');
    return response.json();
  },

  async getLogs(): Promise<MaintenanceLogData[]> {
    const response = await fetch(`${API_URL}/fleet/logs`);
    if (!response.ok) throw new Error('Failed to fetch maintenance logs');
    return response.json();
  },

  async saveLog(log: Omit<MaintenanceLogData, 'id'>): Promise<MaintenanceLogData> {
    const response = await fetch(`${API_URL}/fleet/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!response.ok) throw new Error('Failed to save maintenance log');
    return response.json();
  }
};
