import { FastifyInstance } from 'fastify';
import { db, Telemetry } from '../../db/db';
import { config } from '../../config/env';
import { influxService } from '../../db/influx';
import { devicesService } from '../devices/devices.service';

export const telemetryService = {
  
  /**
   * Save telemetry data in SQL/local DB and/or InfluxDB
   */
  async saveTelemetry(fastify: FastifyInstance, telemetry: Omit<Telemetry, 'id'>): Promise<Telemetry> {
    let telemetryToSave = { ...telemetry };

    // 1. Try to save to InfluxDB if it is active
    if (influxService.isActive()) {
      fastify.log.info(`[INFLUXDB] 1. Guardando telemetría en InfluxDB para ${telemetry.device_id}...`);
      await influxService.writeTelemetry(telemetry.device_id, telemetry);
      
      // 2. Query the absolute latest data back from InfluxDB to serve as the source of truth
      try {
        const latestFromInflux = await influxService.queryLatestTelemetry(telemetry.device_id);
        if (latestFromInflux) {
          fastify.log.info(`[INFLUXDB] 2. Telemetría recuperada con éxito de InfluxDB para ${telemetry.device_id}: T=${latestFromInflux.temperature}, H=${latestFromInflux.humidity}, RSSI=${latestFromInflux.rssi}`);
          
          telemetryToSave = {
            device_id: latestFromInflux.device_id ?? telemetry.device_id,
            sequence: latestFromInflux.sequence !== undefined && latestFromInflux.sequence !== null ? Number(latestFromInflux.sequence) : telemetry.sequence,
            temperature: latestFromInflux.temperature !== undefined && latestFromInflux.temperature !== null ? Number(latestFromInflux.temperature) : telemetry.temperature,
            humidity: latestFromInflux.humidity !== undefined && latestFromInflux.humidity !== null ? Number(latestFromInflux.humidity) : telemetry.humidity,
            air_quality: latestFromInflux.air_quality !== undefined && latestFromInflux.air_quality !== null ? Number(latestFromInflux.air_quality) : telemetry.air_quality,
            ultrasonic_cm: latestFromInflux.ultrasonic_cm !== undefined && latestFromInflux.ultrasonic_cm !== null ? Number(latestFromInflux.ultrasonic_cm) : telemetry.ultrasonic_cm,
            tof_cm: latestFromInflux.tof_cm !== undefined && latestFromInflux.tof_cm !== null ? Number(latestFromInflux.tof_cm) : telemetry.tof_cm,
            obstacle: latestFromInflux.obstacle !== undefined && latestFromInflux.obstacle !== null ? Number(latestFromInflux.obstacle) : telemetry.obstacle,
            altitude: latestFromInflux.altitude !== undefined && latestFromInflux.altitude !== null ? Number(latestFromInflux.altitude) : telemetry.altitude,
            satellites: latestFromInflux.satellites !== undefined && latestFromInflux.satellites !== null ? Number(latestFromInflux.satellites) : telemetry.satellites,
            rssi: latestFromInflux.rssi !== undefined && latestFromInflux.rssi !== null ? Number(latestFromInflux.rssi) : telemetry.rssi,
            snr: latestFromInflux.snr !== undefined && latestFromInflux.snr !== null ? Number(latestFromInflux.snr) : telemetry.snr,
            pkts: latestFromInflux.pkts !== undefined && latestFromInflux.pkts !== null ? Number(latestFromInflux.pkts) : telemetry.pkts,
            crc_ok: telemetry.crc_ok ?? 1,
            crc_err: telemetry.crc_err ?? 0,
            timestamp: latestFromInflux.timestamp ? new Date(latestFromInflux.timestamp).toISOString() : telemetry.timestamp
          };
        } else {
          fastify.log.warn(`[INFLUXDB] No se pudo encontrar registro tras guardar telemetría para ${telemetry.device_id}, usando payload original.`);
        }
      } catch (err) {
        fastify.log.error(`[INFLUXDB] Error leyendo de vuelta desde InfluxDB para ${telemetry.device_id}: ${err}`);
      }
    }

    // 3. Save in base DB mode as well for unified API querying or fallback
    if (config.db.mode === 'prisma') {
      const newTelemetry = await fastify.prisma.telemetry.create({
        data: {
          device_id: telemetryToSave.device_id,
          sequence: telemetryToSave.sequence,
          temperature: telemetryToSave.temperature,
          humidity: telemetryToSave.humidity,
          air_quality: telemetryToSave.air_quality,
          ultrasonic_cm: telemetryToSave.ultrasonic_cm,
          tof_cm: telemetryToSave.tof_cm,
          obstacle: telemetryToSave.obstacle,
          altitude: telemetryToSave.altitude,
          satellites: telemetryToSave.satellites,
          rssi: telemetryToSave.rssi,
          snr: telemetryToSave.snr,
          pkts: telemetryToSave.pkts,
          crc_ok: telemetryToSave.crc_ok ?? 1,
          crc_err: telemetryToSave.crc_err ?? 0,
          battery: telemetryToSave.battery ?? 0,
          battery_pct: telemetryToSave.battery_pct ?? 0,
          batt_current_ma: telemetryToSave.batt_current_ma ?? 0,
          batt_power_mw: telemetryToSave.batt_power_mw ?? 0,
          batt_remaining_mah: telemetryToSave.batt_remaining_mah ?? 0,
          batt_consumed_mah: telemetryToSave.batt_consumed_mah ?? 0,
          batt_runtime_min: telemetryToSave.batt_runtime_min ?? 0,
          batt_energy_consumed_mwh: telemetryToSave.batt_energy_consumed_mwh ?? 0,
          batt_energy_total_mwh: telemetryToSave.batt_energy_total_mwh ?? 0,
          batt_low: telemetryToSave.batt_low ?? 0,
          batt_critical: telemetryToSave.batt_critical ?? 0,
          timestamp: telemetryToSave.timestamp ? new Date(telemetryToSave.timestamp) : new Date()
        }
      });
      return newTelemetry as unknown as Telemetry;
    } else {
      return db.saveTelemetry(telemetryToSave);
    }
  },

  /**
   * Fetch the most recent telemetry readings for all devices
   */
  async getLatestTelemetry(fastify: FastifyInstance): Promise<Record<string, Telemetry>> {
    if (config.db.mode === 'prisma') {
      // Find latest telemetry per device
      // Since prisma doesn't support raw DISTINCT ON directly without raw queries in postgres,
      // we can perform a clean raw query or a group query. In PostgreSQL, DISTINCT ON is highly performant.
      try {
        const rawLatest = await fastify.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT ON (device_id) *
          FROM telemetry
          ORDER BY device_id, timestamp DESC
        `);

        const latestMap: Record<string, Telemetry> = {};
        for (const t of rawLatest) {
          latestMap[t.device_id] = {
            id: t.id,
            device_id: t.device_id,
            sequence: t.sequence,
            temperature: Number(t.temperature),
            humidity: Number(t.humidity),
            air_quality: t.air_quality,
            ultrasonic_cm: Number(t.ultrasonic_cm),
            tof_cm: Number(t.tof_cm),
            obstacle: t.obstacle,
            altitude: Number(t.altitude),
            satellites: t.satellites,
            rssi: t.rssi,
            snr: Number(t.snr),
            pkts: t.pkts,
            crc_ok: t.crc_ok,
            crc_err: t.crc_err,
            battery: Number(t.battery ?? 0),
            battery_pct: Number(t.battery_pct ?? 0),
            batt_current_ma: Number(t.batt_current_ma ?? 0),
            batt_power_mw: Number(t.batt_power_mw ?? 0),
            batt_remaining_mah: Number(t.batt_remaining_mah ?? 0),
            batt_consumed_mah: Number(t.batt_consumed_mah ?? 0),
            batt_runtime_min: Number(t.batt_runtime_min ?? 0),
            batt_energy_consumed_mwh: Number(t.batt_energy_consumed_mwh ?? 0),
            batt_energy_total_mwh: Number(t.batt_energy_total_mwh ?? 0),
            batt_low: Number(t.batt_low ?? 0),
            batt_critical: Number(t.batt_critical ?? 0),
            timestamp: t.timestamp.toISOString()
          };
        }
        return latestMap;
      } catch (err) {
        // Fallback simple query
        fastify.log.warn(`[PRISMA] Error fetching distinct telemetry, using simple fallback: ${err}`);
        const allTelemetry = await fastify.prisma.telemetry.findMany({
          orderBy: { timestamp: 'desc' }
        });
        const latestMap: Record<string, Telemetry> = {};
        for (const t of allTelemetry) {
          if (!latestMap[t.device_id]) {
            latestMap[t.device_id] = t as unknown as Telemetry;
          }
        }
        return latestMap;
      }
    } else {
      return db.getLatestTelemetry();
    }
  },

  /**
   * Fetch timeline historical telemetry for a specific device
   */
  async getTelemetryHistory(fastify: FastifyInstance, deviceId: string, range: string = '24h'): Promise<Telemetry[]> {
    // Determine range minutes
    let minutes = 1440; // 24h default
    if (range === '1h') minutes = 60;
    else if (range === '6h') minutes = 360;
    else if (range === '24h') minutes = 1440;
    else if (range === '7d') minutes = 10080;

    // 1. Try to read from InfluxDB if active
    if (influxService.isActive()) {
      const influxHistory = await influxService.queryTelemetryHistory(deviceId, minutes);
      if (influxHistory.length > 0) {
        return influxHistory;
      }
    }

    // 2. Fallback to SQL or JSON DB
    if (config.db.mode === 'prisma') {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      const history = await fastify.prisma.telemetry.findMany({
        where: {
          device_id: deviceId,
          timestamp: { gte: cutoff }
        },
        orderBy: { timestamp: 'asc' }
      });
      return history as unknown as Telemetry[];
    } else {
      return db.getTelemetryHistory(deviceId, range);
    }
  },

  /**
   * Fetch all telemetry stats for a given range, organized by device
   */
  async getAllStats(fastify: FastifyInstance, range: string = '5m'): Promise<Record<string, any[]>> {
    const minutes = range === '1h' ? 60 : range === '6h' ? 360 : range === '24h' ? 1440 : range === '7d' ? 10080 : parseInt(range, 10) || 5;
    const stats: Record<string, any[]> = {};

    // 1. Try InfluxDB first
    if (influxService.isActive()) {
      const raw = await influxService.queryAllTelemetryHistory(minutes);
      for (const entry of raw) {
        const devId = entry.device_id || 'unknown';
        if (!stats[devId]) stats[devId] = [];
        stats[devId].push(entry);
      }
      if (Object.keys(stats).length > 0) return stats;
    }

    // 2. Fallback to SQL / JSON DB
    const devices = await devicesService.getDevices(fastify);
    for (const device of devices) {
      const history = await this.getTelemetryHistory(fastify, device.device_id, '1h');
      if (history.length > 0) {
        stats[device.device_id] = history;
      }
    }

    return stats;
  },

  /**
   * MQTT listener callback: Processes incoming node telemetry
   */
  async processNodeTelemetry(fastify: FastifyInstance, nodeId: string, data: any, gatewayId?: string) {
    try {
      // PRIORIDAD AL HARDWARE REAL:
      // Si el dispositivo ya está registrado y enlazado al gateway real ('gateway_01'), 
      // e intentamos procesar una trama proveniente del simulador ('gateway_02'), abortamos de inmediato.
      const devices = await devicesService.getDevices(fastify);
      const device = devices.find(d => d.device_id === nodeId);
      
      if (device && device.gateway_id?.toLowerCase() === 'gateway_01' && gatewayId?.toLowerCase() === 'gateway_02') {
        fastify.log.warn(`[MQTT] [PRIORIDAD REAL] Ignorando telemetría simulada de gateway_02 para el nodo de hardware real: ${nodeId}`);
        return;
      }

      // 1. Format telemetry entry
      const telemetryEntry = {
        device_id: nodeId,
        sequence: Number(data.sequence || 0),
        temperature: Number(data.temperature ?? 24),
        humidity: Number(data.humidity ?? 50),
        air_quality: Number(data.air_quality ?? 100),
        ultrasonic_cm: Number(data.ultrasonic_cm ?? data.tof_cm ?? 80),
        tof_cm: Number(data.tof_cm ?? data.ultrasonic_cm ?? 80),
        obstacle: Number(data.obstacle || 0),
        altitude: Number(data.altitude ?? 2335),
        satellites: Number(data.satellites ?? 10),
        rssi: Number(data.rssi ?? -70),
        snr: Number(data.snr ?? 8.0),
        pkts: Number(data.pkts ?? 1),
        crc_ok: Number(data.crc_ok ?? 1),
        crc_err: Number(data.crc_err ?? 0),
        battery: Number(data.battery ?? 0),
        battery_pct: Number(data.battery_pct ?? data.BATP ?? 0),
        batt_current_ma: Number(data.batt_current_ma ?? 0),
        batt_power_mw: Number(data.batt_power_mw ?? 0),
        batt_remaining_mah: Number(data.batt_remaining_mah ?? 0),
        batt_consumed_mah: Number(data.batt_consumed_mah ?? 0),
        batt_runtime_min: Number(data.batt_runtime_min ?? 0),
        batt_energy_consumed_mwh: Number(data.batt_energy_consumed_mwh ?? 0),
        batt_energy_total_mwh: Number(data.batt_energy_total_mwh ?? 0),
        batt_low: Number(data.batt_low ?? 0),
        batt_critical: Number(data.batt_critical ?? 0),
        timestamp: new Date().toISOString()
      };

      // 2. Save in database
      const savedTelemetry = await this.saveTelemetry(fastify, telemetryEntry);
      
      // 3. Estimate Status and Battery based on container fill level, signal strength (RSSI), battery, and noise (SNR)
      const fillDistance = telemetryEntry.tof_cm || telemetryEntry.ultrasonic_cm;
      
      // Extraer nivel de batería (porcentaje 0-100) de forma robusta
      let battery_level = 100;
      if (typeof data.BATP === 'number') {
        battery_level = Math.round(data.BATP);
      } else if (typeof data.batp === 'number') {
        battery_level = Math.round(data.batp);
      } else if (typeof data.battery === 'number') {
        if (data.battery > 5.0) {
          // Viene directamente en porcentaje (ej. 85%)
          battery_level = Math.round(data.battery);
        } else {
          // Viene en formato voltaje (ej. 3.63V). Mapeamos de 3.0V (0%) a 4.2V (100%)
          const voltage = data.battery;
          const percentage = ((voltage - 3.0) / (4.2 - 3.0)) * 100;
          battery_level = Math.round(Math.max(0, Math.min(100, percentage)));
        }
      } else {
        // Fallback estimado basado en secuencia
        battery_level = 95 - Math.min(15, Math.floor(telemetryEntry.sequence / 100));
      }
      
      let status: 'Online' | 'Warning' | 'Offline' = 'Online';
      if (telemetryEntry.rssi <= -105 || telemetryEntry.snr <= -5.0) {
        status = 'Offline'; // Total loss of connection due to low signal or excessive noise
      } else if (fillDistance <= 15 || battery_level <= 15 || telemetryEntry.rssi <= -95 || telemetryEntry.snr <= 1.0) {
        status = 'Warning'; // Warning due to low battery, weak signal, high noise, or full container
      }

      // Extract dynamic GPS coordinates sent by MQTT broker
      let gpsLat: number | undefined = undefined;
      let gpsLng: number | undefined = undefined;

      if (typeof data.latitude === 'number' && data.latitude !== 0) {
        gpsLat = data.latitude;
      } else if (typeof data.la === 'number' && data.la !== 0) {
        gpsLat = data.la;
      }

      if (typeof data.longitude === 'number' && data.longitude !== 0) {
        gpsLng = data.longitude;
      } else if (typeof data.lo === 'number' && data.lo !== 0) {
        gpsLng = data.lo;
      }

      // 4. Update or Auto-Register Device

      if (device) {
        const deviceUpdates: Partial<any> = {
          status,
          signal_strength: telemetryEntry.rssi,
          battery_level,
          last_seen: new Date().toISOString(),
          gateway_id: gatewayId || device.gateway_id
        };

        // Si el broker envió coordenadas GPS dinámicas en la trama (no cero), las usamos.
        // Si no las envió (o envió 0), mantenemos las coordenadas registradas en base de datos.
        // Si tampoco hay coordenadas en la base de datos (son 0 o nulas), usamos por mientras la ubicación de Plaza Yanahuara.
        const currentLat = gpsLat !== undefined ? gpsLat : (device.latitude && device.latitude !== 0 ? device.latitude : -16.3888);
        const currentLng = gpsLng !== undefined ? gpsLng : (device.longitude && device.longitude !== 0 ? device.longitude : -71.5415);
        
        deviceUpdates.latitude = currentLat;
        deviceUpdates.longitude = currentLng;
        
        // Sincronizar dinámicamente las coordenadas del MapPoint enlazado para actualizar el mapa 3D en tiempo real
        if (device.map_point_id) {
          try {
            await devicesService.updateMapPoint(fastify, device.map_point_id, {
              latitude: currentLat,
              longitude: currentLng
            });
            if (gpsLat !== undefined && gpsLng !== undefined) {
              fastify.log.info(`[GPS] Coordenadas del punto de mapa [ID: ${device.map_point_id}] actualizadas con GPS real a: ${gpsLat}, ${gpsLng}`);
            } else {
              fastify.log.info(`[GPS] Usando ubicación guardada/temporal para el punto de mapa [ID: ${device.map_point_id}]: ${currentLat}, ${currentLng}`);
            }
          } catch (err) {
            fastify.log.error(`[GPS] Error actualizando coordenadas de MapPoint para ${nodeId}: ${err}`);
          }
        }

        await devicesService.updateDevice(fastify, nodeId, deviceUpdates);
      } else {
        // DO NOT Auto-Register in DB! Instead, put in memory discovery queue!
        await devicesService.addDiscoveredDevice(fastify, {
          device_id: nodeId,
          type: 'Nodo Sensor',
          battery_level,
          signal_strength: telemetryEntry.rssi,
          gateway_id: gatewayId || null
        });
        fastify.log.info(`[MQTT] Nuevo dispositivo [${nodeId}] detectado pero NO registrado. Guardado en la cola de descubrimiento.`);
      }

      // 5. Broadcast to connected WebSocket clients in real-time!
      fastify.broadcast({
        event: 'telemetry',
        device_id: nodeId,
        data: {
          ...(savedTelemetry as any),
          battery: battery_level,
          battery_level: battery_level,
          batt_current_ma: telemetryEntry.batt_current_ma,
          batt_power_mw: telemetryEntry.batt_power_mw,
          batt_remaining_mah: telemetryEntry.batt_remaining_mah,
          batt_consumed_mah: telemetryEntry.batt_consumed_mah,
          batt_runtime_min: telemetryEntry.batt_runtime_min,
          batt_energy_consumed_mwh: telemetryEntry.batt_energy_consumed_mwh,
          batt_energy_total_mwh: telemetryEntry.batt_energy_total_mwh,
          batt_low: telemetryEntry.batt_low,
          batt_critical: telemetryEntry.batt_critical
        }
      });
      
    } catch (err) {
      fastify.log.error(`[MQTT] Error procesando telemetría de nodo [${nodeId}]: ${err}`);
    }
  }
};
