import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { config } from '../config/env';

class InfluxService {
  private client: InfluxDB | null = null;
  private writeApi: WriteApi | null = null;
  private queryApi: QueryApi | null = null;
  private isConfigured = false;

  constructor() {
    const { url, token, org, bucket } = config.influx;

    if (url && token && org && bucket) {
      try {
        console.log(`[INFLUXDB] Intentando inicializar cliente en: ${url}`);
        this.client = new InfluxDB({ url, token });
        
        // Write API is set up to write points using batching and default configuration
        this.writeApi = this.client.getWriteApi(org, bucket, 'ns');
        this.queryApi = this.client.getQueryApi(org);
        
        this.isConfigured = true;
        console.log('[INFLUXDB] Cliente inicializado correctamente.');
      } catch (err) {
        console.error('[INFLUXDB] Error configurando cliente de InfluxDB:', err);
        this.isConfigured = false;
      }
    } else {
      console.log('[INFLUXDB] Servidor de InfluxDB no configurado. Utilizando base de datos relacional/local como fallback.');
    }
  }

  /**
   * Check if InfluxDB integration is active
   */
  public isActive(): boolean {
    return this.isConfigured;
  }

  /**
   * Write telemetry point to InfluxDB
   */
  public async writeTelemetry(deviceId: string, telemetry: Record<string, any>): Promise<boolean> {
    if (!this.isConfigured || !this.writeApi) {
      return false;
    }

    try {
      const point = new Point('telemetry')
        .tag('device_id', deviceId)
        .intField('sequence', telemetry.sequence || 0)
        .floatField('temperature', telemetry.temperature ?? 0)
        .floatField('humidity', telemetry.humidity ?? 0)
        .intField('air_quality', telemetry.air_quality ?? 0)
        .floatField('ultrasonic_cm', telemetry.ultrasonic_cm ?? 0)
        .floatField('tof_cm', telemetry.tof_cm ?? 0)
        .intField('obstacle', telemetry.obstacle ?? 0)
        .floatField('altitude', telemetry.altitude ?? 0)
        .intField('satellites', telemetry.satellites ?? 0)
        .intField('rssi', telemetry.rssi ?? 0)
        .floatField('snr', telemetry.snr ?? 0)
        .intField('pkts', telemetry.pkts ?? 0)
        .floatField('battery', telemetry.battery ?? 0)
        .floatField('battery_pct', telemetry.battery_pct ?? 0)
        .floatField('batt_current_ma', telemetry.batt_current_ma ?? 0)
        .floatField('batt_power_mw', telemetry.batt_power_mw ?? 0)
        .floatField('batt_remaining_mah', telemetry.batt_remaining_mah ?? 0)
        .floatField('batt_consumed_mah', telemetry.batt_consumed_mah ?? 0)
        .floatField('batt_runtime_min', telemetry.batt_runtime_min ?? 0)
        .floatField('batt_energy_consumed_mwh', telemetry.batt_energy_consumed_mwh ?? 0)
        .floatField('batt_energy_total_mwh', telemetry.batt_energy_total_mwh ?? 0)
        .intField('batt_low', telemetry.batt_low ?? 0)
        .intField('batt_critical', telemetry.batt_critical ?? 0);

      this.writeApi.writePoint(point);
      
      // Optionally flush immediately in dev environment (though batching is preferred in prod)
      await this.writeApi.flush();
      return true;
    } catch (err) {
      console.error(`[INFLUXDB] Error escribiendo telemetría para ${deviceId}:`, err);
      return false;
    }
  }

  /**
   * Write fleet vehicle telemetry point to InfluxDB for time-series tracing
   */
  public async writeFleetTelemetry(vehicleId: string, telemetry: Record<string, any>): Promise<boolean> {
    if (!this.isConfigured || !this.writeApi) {
      return false;
    }

    try {
      // Robust regex to extract latitude and longitude from location string
      const match = telemetry.location ? telemetry.location.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) : null;
      let lat = 0.0;
      let lng = 0.0;
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }

      const point = new Point('fleet_telemetry')
        .tag('vehicle_id', vehicleId)
        .tag('driver', telemetry.driver || 'N/A')
        .tag('status', telemetry.status || 'Available')
        .floatField('fuel', telemetry.fuel ?? 0.0)
        .floatField('capacity', telemetry.capacity ?? 0.0)
        .floatField('speed', telemetry.speed ?? 0.0)
        .floatField('latitude', lat)
        .floatField('longitude', lng);

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
      return true;
    } catch (err) {
      console.error(`[INFLUXDB] Error escribiendo telemetría de flota para ${vehicleId}:`, err);
      return false;
    }
  }

  /**
   * Query the latest telemetry point from InfluxDB for a specific device
   */
  public async queryLatestTelemetry(deviceId: string): Promise<any | null> {
    if (!this.isConfigured || !this.queryApi) {
      return null;
    }

    const { bucket } = config.influx;
    
    // Flux query to fetch the absolute latest telemetry point for a specific device
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_measurement"] == "telemetry")
        |> filter(fn: (r) => r["device_id"] == "${deviceId}")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    try {
      const results: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        this.queryApi!.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            results.push({
              device_id: o.device_id,
              sequence: o.sequence,
              temperature: o.temperature,
              humidity: o.humidity,
              air_quality: o.air_quality,
              ultrasonic_cm: o.ultrasonic_cm,
              tof_cm: o.tof_cm,
              obstacle: o.obstacle,
              altitude: o.altitude,
              satellites: o.satellites,
              rssi: o.rssi,
              snr: o.snr,
              pkts: o.pkts,
              battery: o.battery ?? 0,
              battery_pct: o.battery_pct ?? 0,
              batt_current_ma: o.batt_current_ma ?? 0,
              batt_power_mw: o.batt_power_mw ?? 0,
              batt_remaining_mah: o.batt_remaining_mah ?? 0,
              batt_consumed_mah: o.batt_consumed_mah ?? 0,
              batt_runtime_min: o.batt_runtime_min ?? 0,
              batt_energy_consumed_mwh: o.batt_energy_consumed_mwh ?? 0,
              batt_energy_total_mwh: o.batt_energy_total_mwh ?? 0,
              batt_low: o.batt_low ?? 0,
              batt_critical: o.batt_critical ?? 0,
              timestamp: o._time
            });
          },
          error(err) {
            reject(err);
          },
          complete() {
            resolve();
          }
        });
      });

      return results.length > 0 ? results[0] : null;
    } catch (err) {
      console.error(`[INFLUXDB] Error consultando última telemetría para ${deviceId}:`, err);
      return null;
    }
  }

  /**
   * Query historical telemetry data from InfluxDB
   */
  public async queryTelemetryHistory(deviceId: string, rangeMinutes: number = 1440): Promise<any[]> {
    if (!this.isConfigured || !this.queryApi) {
      return [];
    }

    const { bucket, org } = config.influx;
    
    // Flux query language
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${rangeMinutes}m)
        |> filter(fn: (r) => r["_measurement"] == "telemetry")
        |> filter(fn: (r) => r["device_id"] == "${deviceId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: false)
    `;

    try {
      const results: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        this.queryApi!.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            results.push({
              device_id: o.device_id,
              sequence: o.sequence,
              temperature: o.temperature,
              humidity: o.humidity,
              air_quality: o.air_quality,
              ultrasonic_cm: o.ultrasonic_cm,
              tof_cm: o.tof_cm,
              obstacle: o.obstacle,
              altitude: o.altitude,
              satellites: o.satellites,
              rssi: o.rssi,
              snr: o.snr,
              pkts: o.pkts,
              battery: o.battery ?? 0,
              battery_pct: o.battery_pct ?? 0,
              batt_current_ma: o.batt_current_ma ?? 0,
              batt_power_mw: o.batt_power_mw ?? 0,
              batt_remaining_mah: o.batt_remaining_mah ?? 0,
              batt_consumed_mah: o.batt_consumed_mah ?? 0,
              batt_runtime_min: o.batt_runtime_min ?? 0,
              batt_energy_consumed_mwh: o.batt_energy_consumed_mwh ?? 0,
              batt_energy_total_mwh: o.batt_energy_total_mwh ?? 0,
              batt_low: o.batt_low ?? 0,
              batt_critical: o.batt_critical ?? 0,
              timestamp: o._time
            });
          },
          error(err) {
            reject(err);
          },
          complete() {
            resolve();
          }
        });
      });

      return results;
    } catch (err) {
      console.error(`[INFLUXDB] Error consultando histórico para ${deviceId}:`, err);
      return [];
    }
  }

  /**
   * Query all telemetry data from all devices within a time range
   */
  public async queryAllTelemetryHistory(rangeMinutes: number = 60): Promise<any[]> {
    if (!this.isConfigured || !this.queryApi) {
      return [];
    }

    const { bucket, org } = config.influx;

    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${rangeMinutes}m)
        |> filter(fn: (r) => r["_measurement"] == "telemetry")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: false)
    `;

    try {
      const results: any[] = [];

      await new Promise<void>((resolve, reject) => {
        this.queryApi!.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            results.push({
              device_id: o.device_id,
              sequence: o.sequence,
              temperature: o.temperature,
              humidity: o.humidity,
              air_quality: o.air_quality,
              ultrasonic_cm: o.ultrasonic_cm,
              tof_cm: o.tof_cm,
              obstacle: o.obstacle,
              altitude: o.altitude,
              satellites: o.satellites,
              rssi: o.rssi,
              snr: o.snr,
              pkts: o.pkts,
              battery: o.battery ?? 0,
              battery_pct: o.battery_pct ?? 0,
              batt_current_ma: o.batt_current_ma ?? 0,
              batt_power_mw: o.batt_power_mw ?? 0,
              batt_remaining_mah: o.batt_remaining_mah ?? 0,
              batt_consumed_mah: o.batt_consumed_mah ?? 0,
              batt_runtime_min: o.batt_runtime_min ?? 0,
              batt_energy_consumed_mwh: o.batt_energy_consumed_mwh ?? 0,
              batt_energy_total_mwh: o.batt_energy_total_mwh ?? 0,
              batt_low: o.batt_low ?? 0,
              batt_critical: o.batt_critical ?? 0,
              timestamp: o._time
            });
          },
          error(err) {
            reject(err);
          },
          complete() {
            resolve();
          }
        });
      });

      return results;
    } catch (err) {
      console.error(`[INFLUXDB] Error consultando histórico completo:`, err);
      return [];
    }
  }

  /**
   * Graceful close of InfluxDB streams
   */
  public async close() {
    if (this.writeApi) {
      try {
        await this.writeApi.close();
        console.log('[INFLUXDB] Conexiones cerradas de forma ordenada.');
      } catch (err) {
        console.error('[INFLUXDB] Error cerrando WriteApi de InfluxDB:', err);
      }
    }
  }
}

export const influxService = new InfluxService();
