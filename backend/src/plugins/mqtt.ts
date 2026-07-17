import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import * as mqtt from 'mqtt';
import { config } from '../config/env';

declare module 'fastify' {
  interface FastifyInstance {
    mqtt: {
      client: mqtt.MqttClient | null;
      publishCommand: (gatewayId: string, nodeId: string | null, commandObj: Record<string, any>) => boolean;
    };
  }
}

const mqttPlugin: FastifyPluginAsync = fp(async (fastify, opts) => {
  let client: mqtt.MqttClient | null = null;

  fastify.log.info(`[MQTT] Intentando conectar al broker en: ${config.mqtt.broker}:${config.mqtt.port}`);

  const options: mqtt.IClientOptions = {
    port: config.mqtt.port,
    reconnectPeriod: 5000,
  };

  if (config.mqtt.username) options.username = config.mqtt.username;
  if (config.mqtt.password) options.password = config.mqtt.password;

  try {
    client = mqtt.connect(config.mqtt.broker, options);

    client.on('connect', () => {
      fastify.log.info('[MQTT] ¡Conectado al broker MQTT exitosamente!');
      
      // Subscribe to telemetry and status
      client?.subscribe('lora/+/+/telemetry', (err) => {
        if (err) fastify.log.error(`[MQTT] Error suscribiendo a telemetría: ${err}`);
        else fastify.log.info('[MQTT] Suscrito a: lora/+/+/telemetry');
      });

      client?.subscribe('lora/+/status', (err) => {
        if (err) fastify.log.error(`[MQTT] Error suscribiendo a estado: ${err}`);
        else fastify.log.info('[MQTT] Suscrito a: lora/+/status');
      });

      client?.subscribe('fleet/+/telemetry', (err) => {
        if (err) fastify.log.error(`[MQTT] Error suscribiendo a telemetría de flota: ${err}`);
        else fastify.log.info('[MQTT] Suscrito a: fleet/+/telemetry');
      });
    });

    // ─── Compact CSV → JSON parser (mirrors firmware parser_service.cpp) ──────
    // Handles any of these formats coming from LoRa nodes:
    //   1. Pure JSON:              {"temperature":24,"humidity":50,...}
    //   2. Compact CSV (raw):      N7,P364,T14,H61,AQ100,U82,TOF80,IR0,B2335,S10,CRC42
    //   3. Node-prefixed CSV:      N7,P364,T14,H61,...  (node id still in payload)
    //   4. Gateway-wrapped value:  {"value":"N7,P364,..."}
    const COMPACT_KEY_MAP: Record<string, string> = {
      P:    'sequence',
      T:    'temperature',
      H:    'humidity',
      AQ:   'air_quality',
      U:    'ultrasonic_cm',
      TOF:  'tof_cm',
      IR:   'obstacle',
      B:    'altitude',
      S:    'satellites',
      BAT:  'battery',
      RSSI: 'rssi',
      SNR:  'snr',
      LA:   'latitude',
      LO:   'longitude',
      CRC:  'crc',
      N:    '_node_id'      // node-id prefix field, kept for reference but not stored
    };

    function parseCompactCSV(csv: string): Record<string, any> {
      const result: Record<string, any> = {};
      const fields = csv.split(',');
      for (const field of fields) {
        const match = field.match(/^([A-Z]+)(\-?\d+\.?\d*)$/);
        if (!match) continue;
        const [, key, rawVal] = match;
        const jsonKey = COMPACT_KEY_MAP[key] ?? key.toLowerCase();
        if (jsonKey === '_node_id') continue; // skip node id prefix
        result[jsonKey] = parseFloat(rawVal);
      }
      return result;
    }

    function parseLoraPayload(raw: string): Record<string, any> {
      const trimmed = raw.trim();

      // 1. Try pure JSON first
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed); // may throw — caller catches
        // Handle gateway-wrapped: {"value":"N7,P364,T14,..."}
        if (typeof parsed.value === 'string' && !parsed.value.startsWith('{')) {
          return parseCompactCSV(parsed.value);
        }
        return parsed;
      }

      // 2. Compact CSV (with or without N-prefix)
      return parseCompactCSV(trimmed);
    }
    // ─────────────────────────────────────────────────────────────────────────

    client.on('message', async (topic, message) => {
      const payloadStr = message.toString();
      try {
        const topicParts = topic.split('/');
        
        // 1. Gateway Status Packet: lora/{gateway}/status
        if (topicParts.length === 3 && topicParts[2] === 'status') {
          const gatewayId = topicParts[1];
          // We will delegate to a service or inject it
          // To decouple, we fetch the service inside the handler
          const { devicesService } = await import('../modules/devices/devices.service');
          await devicesService.updateGatewayStatus(fastify, gatewayId, payloadStr);
        }
        
        // 2. Node Telemetry Packet: lora/{gateway}/{node}/telemetry
        // Uses parseLoraPayload() to handle raw CSV, node-prefixed CSV, wrapped {"value":...} or pure JSON
        else if (topicParts.length === 4 && topicParts[3] === 'telemetry') {
          const gatewayId = topicParts[1];
          const nodeId = topicParts[2];
          const data = parseLoraPayload(payloadStr);
          const { telemetryService } = await import('../modules/telemetry/telemetry.service');
          await telemetryService.processNodeTelemetry(fastify, nodeId, data, gatewayId);
        }

        // 3. Fleet Telemetry Packet: fleet/{vehicleId}/telemetry
        // Uses upsertVehicle so the vehicle is auto-created in DB if it doesn't exist yet
        else if (topicParts.length === 3 && topicParts[0] === 'fleet' && topicParts[2] === 'telemetry') {
          const vehicleId = topicParts[1];
          const data = JSON.parse(payloadStr);
          const { fleetService } = await import('../modules/fleet/fleet.service');
          
          const updated = await fleetService.upsertVehicle(fastify, vehicleId, {
            fuel: typeof data.fuel === 'number' ? data.fuel : undefined,
            capacity: typeof data.capacity === 'number' ? data.capacity : undefined,
            location: typeof data.location === 'string' ? data.location : undefined,
            speed: typeof data.speed === 'number' ? data.speed : undefined,
            status: typeof data.status === 'string' ? data.status : undefined,
            driver: typeof data.driver === 'string' ? data.driver : undefined,
            last_update: 'Justo ahora'
          });

          fastify.log.info(`[MQTT] Camión ${vehicleId} upserted: vel=${updated.speed} km/h, comb=${updated.fuel}%, loc=${updated.location}`);

          // Dual Storage: Save time-series points to InfluxDB if it is configured and active
          const { influxService } = await import('../db/influx');
          if (influxService.isActive()) {
            await influxService.writeFleetTelemetry(vehicleId, {
              fuel: updated.fuel,
              capacity: updated.capacity,
              location: updated.location,
              speed: updated.speed,
              status: updated.status,
              driver: updated.driver
            });
            fastify.log.info(`[INFLUXDB] Telemetría de flota e historial guardado para camión ${vehicleId}`);
          }

          // Emit real-time change to all active WebSocket connections
          fastify.broadcast({
            event: 'fleet_update',
            data: updated
          });
        }
      } catch (error) {
        fastify.log.error(`[MQTT] Error procesando mensaje del tópico [${topic}]: ${error}`);
      }
    });

    client.on('error', (err) => {
      fastify.log.error(`[MQTT] Error en el cliente MQTT: ${err}`);
    });

  } catch (err) {
    fastify.log.error(`[MQTT] Error inicializando cliente MQTT: ${err}`);
  }

  // Define helper to publish command
  const publishCommand = (gatewayId: string, nodeId: string | null, commandObj: Record<string, any>): boolean => {
    if (!client || !client.connected) {
      fastify.log.warn('[MQTT] No se pueden enviar comandos, cliente MQTT desconectado.');
      return false;
    }

    const payload = JSON.stringify(commandObj);
    const topic = nodeId ? `lora/${gatewayId}/${nodeId}/command` : `lora/${gatewayId}/command`;

    fastify.log.info(`[MQTT] Publicando comando en [${topic}]: ${payload}`);
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) fastify.log.error(`[MQTT] Error enviando comando a ${topic}: ${err}`);
    });

    return true;
  };

  fastify.decorate('mqtt', {
    client,
    publishCommand,
  });

  fastify.addHook('onClose', async () => {
    if (client) {
      await new Promise<void>((resolve) => {
        client!.end(false, {}, () => {
          fastify.log.info('[MQTT] Conexión cerrada de forma ordenada.');
          resolve();
        });
      });
    }
  });
});

export default mqttPlugin;
export { mqttPlugin };
