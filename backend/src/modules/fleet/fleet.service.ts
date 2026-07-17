import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/env';

const VEHICLES_FILE = path.join(__dirname, '../../../data/vehicles.json');
const LOGS_FILE = path.join(__dirname, '../../../data/maintenance_logs.json');

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

export interface MaintenanceLogData {
  id?: number;
  vehicle_id: string;
  description: string;
  cost?: number;
  severity: 'error' | 'warning' | 'info';
  date?: string;
}

const defaultVehicles: VehicleData[] = [
  { id: 'T-101', plate: 'BC-1234', driver: 'Juan Pérez', status: 'In Route', fuel: 75, capacity: 85, location: 'Av. Ejercito, 402', last_update: 'Hace 2 min', speed: 64 },
  { id: 'T-102', plate: 'XY-5678', driver: 'Carlos Ruiz', status: 'Available', fuel: 92, capacity: 0, location: 'Base Central', last_update: 'Hace 15 min', speed: 0 },
  { id: 'T-103', plate: 'LM-9012', driver: 'N/A', status: 'Maintenance', fuel: 15, capacity: 0, location: 'Taller Norte', last_update: 'Ayer', speed: 0 },
  { id: 'T-104', plate: 'GH-3456', driver: 'Marco Díaz', status: 'Low Fuel', fuel: 12, capacity: 40, location: 'Estación de Servicio', last_update: 'Hace 5 min', speed: 0 },
  { id: 'T-105', plate: 'KJ-7890', driver: 'Luis Torres', status: 'In Route', fuel: 60, capacity: 95, location: 'Plaza de Armas', last_update: 'Justo ahora', speed: 72 }
];

const defaultLogs: MaintenanceLogData[] = [
  { vehicle_id: 'T-104', description: 'Combustible crítico — 12% restante', severity: 'error', date: new Date().toISOString() },
  { vehicle_id: 'T-103', description: 'Mantenimiento programado vencido', severity: 'warning', date: new Date(Date.now() - 86400000).toISOString() },
  { vehicle_id: 'T-101', description: 'Ruta optimizada por IA aplicada', severity: 'info', date: new Date(Date.now() - 720000).toISOString() }
];

export const fleetService = {
  // Helper to read local files
  readJSON(filePath: string, defaultData: any[]): any[] {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return defaultData;
    }
  },

  // Helper to write local files
  writeJSON(filePath: string, data: any[]) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  },

  // === Vehicles Operations ===

  async getVehicles(fastify: FastifyInstance): Promise<VehicleData[]> {
    if (config.db.mode === 'prisma') {
      const dbVehicles = await fastify.prisma.vehicle.findMany({
        orderBy: { id: 'asc' }
      });
      return dbVehicles as unknown as VehicleData[];
    } else {
      return this.readJSON(VEHICLES_FILE, defaultVehicles);
    }
  },

  async saveVehicle(fastify: FastifyInstance, vehicle: VehicleData): Promise<VehicleData> {
    if (config.db.mode === 'prisma') {
      const created = await fastify.prisma.vehicle.create({
        data: {
          id: vehicle.id,
          plate: vehicle.plate,
          driver: vehicle.driver,
          status: vehicle.status,
          fuel: vehicle.fuel,
          capacity: vehicle.capacity,
          location: vehicle.location,
          last_update: vehicle.last_update,
          speed: vehicle.speed
        }
      });
      return created as unknown as VehicleData;
    } else {
      const list = this.readJSON(VEHICLES_FILE, defaultVehicles);
      list.push(vehicle);
      this.writeJSON(VEHICLES_FILE, list);
      return vehicle;
    }
  },

  async updateVehicle(fastify: FastifyInstance, vehicleId: string, updates: Partial<VehicleData>): Promise<VehicleData> {
    if (config.db.mode === 'prisma') {
      const updated = await fastify.prisma.vehicle.update({
        where: { id: vehicleId },
        data: updates as any
      });
      return updated as unknown as VehicleData;
    } else {
      const list = this.readJSON(VEHICLES_FILE, defaultVehicles);
      const index = list.findIndex(v => v.id === vehicleId);
      if (index === -1) throw new Error(`Vehicle ${vehicleId} not found`);
      list[index] = { ...list[index], ...updates };
      this.writeJSON(VEHICLES_FILE, list);
      return list[index];
    }
  },

  /**
   * Upsert vehicle: auto-creates if not found, updates if exists.
   * Used by the MQTT handler so simulator data always lands in the DB.
   */
  async upsertVehicle(fastify: FastifyInstance, vehicleId: string, updates: Partial<VehicleData>): Promise<VehicleData> {
    const defaults: VehicleData = {
      id: vehicleId,
      plate: `SIM-${vehicleId}`,
      driver: updates.driver ?? 'Simulador',
      status: (updates.status as VehicleData['status']) ?? 'Available',
      fuel: updates.fuel ?? 100,
      capacity: updates.capacity ?? 0,
      location: updates.location ?? `Base Central (-16.409000, -71.537000)`,
      last_update: 'Justo ahora',
      speed: updates.speed ?? 0
    };

    if (config.db.mode === 'prisma') {
      const upserted = await fastify.prisma.vehicle.upsert({
        where: { id: vehicleId },
        update: { ...updates, last_update: 'Justo ahora' } as any,
        create: defaults as any
      });
      return upserted as unknown as VehicleData;
    } else {
      const list = this.readJSON(VEHICLES_FILE, defaultVehicles);
      const index = list.findIndex((v: VehicleData) => v.id === vehicleId);
      if (index === -1) {
        const newVehicle = { ...defaults, ...updates };
        list.push(newVehicle);
        this.writeJSON(VEHICLES_FILE, list);
        return newVehicle;
      } else {
        list[index] = { ...list[index], ...updates, last_update: 'Justo ahora' };
        this.writeJSON(VEHICLES_FILE, list);
        return list[index];
      }
    }
  },

  async deleteVehicle(fastify: FastifyInstance, vehicleId: string): Promise<void> {
    if (config.db.mode === 'prisma') {
      await fastify.prisma.vehicle.delete({
        where: { id: vehicleId }
      });
    } else {
      const list = this.readJSON(VEHICLES_FILE, defaultVehicles);
      const filtered = list.filter(v => v.id !== vehicleId);
      this.writeJSON(VEHICLES_FILE, filtered);
    }
  },

  // === Maintenance Logs Operations ===

  async getMaintenanceLogs(fastify: FastifyInstance): Promise<MaintenanceLogData[]> {
    if (config.db.mode === 'prisma') {
      const logs = await fastify.prisma.maintenanceLog.findMany({
        orderBy: { date: 'desc' }
      });
      return logs as unknown as MaintenanceLogData[];
    } else {
      return this.readJSON(LOGS_FILE, defaultLogs);
    }
  },

  async saveMaintenanceLog(fastify: FastifyInstance, log: Omit<MaintenanceLogData, 'id'>): Promise<MaintenanceLogData> {
    if (config.db.mode === 'prisma') {
      const created = await fastify.prisma.maintenanceLog.create({
        data: {
          vehicle_id: log.vehicle_id,
          description: log.description,
          cost: log.cost ?? 0,
          severity: log.severity || 'warning',
          date: log.date ? new Date(log.date) : new Date()
        }
      });
      return created as unknown as MaintenanceLogData;
    } else {
      const list = this.readJSON(LOGS_FILE, defaultLogs);
      const newLog = {
        id: list.length > 0 ? Math.max(...list.map(l => l.id || 0)) + 1 : 1,
        ...log,
        date: log.date || new Date().toISOString()
      };
      list.push(newLog);
      this.writeJSON(LOGS_FILE, list);
      return newLog;
    }
  }
};
