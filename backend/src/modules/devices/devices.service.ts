import { FastifyInstance } from 'fastify';
import { db, Device, MapPoint, RouteData } from '../../db/db';
import { config } from '../../config/env';

export const devicesService = {
  // === In-Memory Discovery Queue ===
  discoveredDevices: new Map<string, {
    device_id: string;
    type: string;
    last_seen: string;
    battery_level?: number;
    signal_strength?: number;
    gateway_id?: string | null;
  }>(),

  async getDiscoveredDevices(fastify: FastifyInstance) {
    const registered = await this.getDevices(fastify);
    const registeredIds = new Set(registered.map(d => d.device_id.toLowerCase()));
    
    const discovered = Array.from(this.discoveredDevices.values()).filter(d => 
      !registeredIds.has(d.device_id.toLowerCase())
    );
    return discovered;
  },

  async addDiscoveredDevice(fastify: FastifyInstance, dev: {
    device_id: string;
    type: string;
    battery_level?: number;
    signal_strength?: number;
    gateway_id?: string | null;
  }) {
    const registered = await this.getDevices(fastify);
    if (registered.some(d => d.device_id.toLowerCase() === dev.device_id.toLowerCase())) {
      return; // Already registered
    }

    this.discoveredDevices.set(dev.device_id.toLowerCase(), {
      ...dev,
      last_seen: new Date().toISOString()
    });

    // Broadcast discovery notification over WS in real time
    fastify.broadcast({
      event: 'device_discovered',
      device_id: dev.device_id,
      data: {
        device_id: dev.device_id,
        type: dev.type,
        last_seen: new Date().toISOString(),
        battery_level: dev.battery_level,
        signal_strength: dev.signal_strength,
        gateway_id: dev.gateway_id
      }
    });
  },

  // === Devices DB Operations ===
  
  async getDevices(fastify: FastifyInstance): Promise<Device[]> {
    if (config.db.mode === 'prisma') {
      const devices = await fastify.prisma.device.findMany({
        orderBy: { id: 'asc' }
      });
      return devices as unknown as Device[];
    } else {
      return db.getDevices();
    }
  },

  async saveDevice(fastify: FastifyInstance, device: Partial<Device>): Promise<Device> {
    let dev: Device;
    if (config.db.mode === 'prisma') {
      const newDevice = await fastify.prisma.device.create({
        data: {
          device_id: device.device_id || `N_${Date.now()}`,
          name: device.name || 'Dispositivo Nuevo',
          type: device.type || 'Nodo Sensor',
          status: device.status || 'Configuring',
          latitude: device.latitude || -16.3988,
          longitude: device.longitude || -71.5368,
          battery_level: device.battery_level ?? 100,
          signal_strength: device.signal_strength ?? -50,
          last_seen: device.last_seen ? new Date(device.last_seen) : new Date(),
          mac_address: device.mac_address || null,
          registered: device.registered !== false,
          map_point_id: device.map_point_id || null,
          gateway_id: device.gateway_id || null,
        }
      });
      dev = newDevice as unknown as Device;
    } else {
      dev = await db.saveDevice(device);
    }

    // Remove from in-memory discovery map
    if (dev.device_id) {
      this.discoveredDevices.delete(dev.device_id.toLowerCase());
    }

    // Broadcast registration over WebSocket in real time
    fastify.broadcast({
      event: 'device_register',
      device_id: dev.device_id,
      data: dev
    });

    return dev;
  },

  async updateDevice(fastify: FastifyInstance, deviceId: string, updates: Partial<Device>): Promise<Device> {
    let dev: Device;
    if (config.db.mode === 'prisma') {
      const dbUpdates: any = { ...updates };
      if (updates.last_seen) {
        dbUpdates.last_seen = new Date(updates.last_seen);
      }

      // Remove non-schema fields just in case
      delete dbUpdates.id;

      const updated = await fastify.prisma.device.update({
        where: { device_id: deviceId },
        data: dbUpdates
      });
      dev = updated as unknown as Device;
    } else {
      dev = await db.updateDevice(deviceId, updates);
    }

    // Broadcast update over WebSocket in real time
    fastify.broadcast({
      event: 'device_update',
      device_id: deviceId,
      data: dev
    });

    // Cascading offline state: If this device is a Gateway and its status is being updated to Offline,
    // all connected sensor nodes must also be marked as Offline in the DB and broadcasted.
    if (dev.type === 'Gateway' && dev.status?.toLowerCase() === 'offline') {
      try {
        const allDevices = await this.getDevices(fastify);
        const children = allDevices.filter(d => 
          d.gateway_id?.toLowerCase() === deviceId.toLowerCase() && 
          d.type === 'Nodo Sensor' && 
          d.status?.toLowerCase() !== 'offline'
        );

        for (const child of children) {
          fastify.log.info(`[CASCADE] Gateway [${deviceId}] está Offline. Marcando nodo hijo [${child.device_id}] como Offline.`);
          await this.updateDevice(fastify, child.device_id, {
            status: 'Offline',
            last_seen: child.last_seen
          });
        }
      } catch (cascadeErr) {
        fastify.log.error(`[CASCADE] Error al propagar estado offline del gateway [${deviceId}]: ${cascadeErr}`);
      }
    }

    return dev;
  },

  async deleteDevice(fastify: FastifyInstance, deviceId: string): Promise<void> {
    if (config.db.mode === 'prisma') {
      await fastify.prisma.device.delete({
        where: { device_id: deviceId }
      });
    } else {
      await db.deleteDevice(deviceId);
    }
  },

  // === Gateway Status Handlers (MQTT Callback) ===

  async updateGatewayStatus(fastify: FastifyInstance, gatewayId: string, statusPayload: string) {
    try {
      const devices = await this.getDevices(fastify);
      const gateway = devices.find(d => d.device_id === gatewayId);
      
      let isOnline = false;
      const cleanPayload = statusPayload.trim();

      if (cleanPayload.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanPayload);
          isOnline = parsed.status?.toLowerCase() === 'online';
        } catch (e) {
          isOnline = cleanPayload.toLowerCase().includes('online');
        }
      } else {
        isOnline = cleanPayload.toLowerCase() === 'online';
      }

      const statusStr = isOnline ? 'Online' : 'Offline';

      if (gateway) {
        await this.updateDevice(fastify, gatewayId, {
          status: statusStr,
          last_seen: new Date().toISOString()
        });
        fastify.log.info(`[MQTT] Gateway [${gatewayId}] actualizado a: ${statusStr}`);
      } else {
        // DO NOT Auto-register in DB! Instead, put in memory discovery queue!
        await this.addDiscoveredDevice(fastify, {
          device_id: gatewayId,
          type: 'Gateway',
          battery_level: 100,
          signal_strength: -50,
          gateway_id: null
        });
        fastify.log.info(`[MQTT] Nuevo Gateway [${gatewayId}] detectado pero NO registrado. Guardado en la cola de descubrimiento.`);
      }
    } catch (err) {
      fastify.log.error(`[MQTT] Error actualizando estado de gateway [${gatewayId}]: ${err}`);
    }
  },

  // === Map Points DB Operations ===

  async getMapPoints(fastify: FastifyInstance): Promise<MapPoint[]> {
    if (config.db.mode === 'prisma') {
      const points = await fastify.prisma.mapPoint.findMany({
        orderBy: { id: 'asc' }
      });
      return points as unknown as MapPoint[];
    } else {
      return db.getMapPoints();
    }
  },

  async saveMapPoint(fastify: FastifyInstance, point: Omit<MapPoint, 'id' | 'created_at'>): Promise<MapPoint> {
    if (config.db.mode === 'prisma') {
      const newPoint = await fastify.prisma.mapPoint.create({
        data: {
          name: point.name,
          latitude: point.latitude,
          longitude: point.longitude,
          type: point.type,
          description: point.description || null,
        }
      });
      return newPoint as unknown as MapPoint;
    } else {
      return db.saveMapPoint(point);
    }
  },

  async updateMapPoint(fastify: FastifyInstance, id: number, updates: Partial<MapPoint>): Promise<MapPoint> {
    if (config.db.mode === 'prisma') {
      // Remove non-schema fields
      const dbUpdates = { ...updates };
      delete dbUpdates.id;
      delete dbUpdates.created_at;

      const updated = await fastify.prisma.mapPoint.update({
        where: { id },
        data: dbUpdates as any
      });
      return updated as unknown as MapPoint;
    } else {
      return db.updateMapPoint(id, updates);
    }
  },

  async deleteMapPoint(fastify: FastifyInstance, id: number): Promise<void> {
    if (config.db.mode === 'prisma') {
      await fastify.prisma.mapPoint.delete({
        where: { id }
      });
    } else {
      await db.deleteMapPoint(id);
    }
  },

  // === Collection Routes DB Operations ===

  async getRoutes(fastify: FastifyInstance): Promise<RouteData[]> {
    if (config.db.mode === 'prisma') {
      const routes = await fastify.prisma.route.findMany({
        orderBy: { id: 'asc' }
      });
      return routes as unknown as RouteData[];
    } else {
      return db.getRoutes();
    }
  },

  async saveRoute(fastify: FastifyInstance, route: RouteData): Promise<RouteData> {
    if (config.db.mode === 'prisma') {
      const newRoute = await fastify.prisma.route.create({
        data: {
          name: route.name,
          district: route.district,
          points: route.points as any,
          distance: route.distance,
          duration: route.duration,
          color: route.color || '#2dd4bf',
        }
      });
      return newRoute as unknown as RouteData;
    } else {
      return db.saveRoute(route);
    }
  },

  async deleteRoute(fastify: FastifyInstance, id: number): Promise<void> {
    if (config.db.mode === 'prisma') {
      await fastify.prisma.route.delete({
        where: { id }
      });
    } else {
      await db.deleteRoute(id);
    }
  }
};
