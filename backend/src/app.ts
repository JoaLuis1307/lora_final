import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { config } from './config/env';
import { prismaPlugin } from './plugins/prisma';
import { mqttPlugin } from './plugins/mqtt';
import { websocketPlugin } from './plugins/websocket';
import { watchdogPlugin } from './plugins/watchdog';
import { authRoutes } from './modules/auth/auth.routes';
import { devicesRoutes } from './modules/devices/devices.routes';
import { telemetryRoutes } from './modules/telemetry/telemetry.routes';
import { fleetRoutes } from './modules/fleet/fleet.routes';

const app = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

export async function buildApp(): Promise<FastifyInstance> {
  // 1. CORS Setup
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. JWT Configuration
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
  });

  // 3. Register Core Plugins
  if (config.db.mode === 'prisma') {
    await app.register(prismaPlugin);
  }
  await app.register(websocketPlugin);
  await app.register(mqttPlugin);
  await app.register(watchdogPlugin);

  // 4. Base Health Checks
  app.get('/', async () => {
    return {
      status: 'online',
      service: 'Smart Containers IoT Backend (Restructured)',
      version: '2.0.0',
      db_mode: config.db.mode,
      mqtt_broker: config.mqtt.broker,
      timestamp: new Date().toISOString()
    };
  });

  app.get('/health', async () => {
    return { status: 'healthy', uptime: process.uptime() };
  });

  // 5. Register Domain Routes with Versioning Prefix
  await app.register(async (api) => {
    await api.register(authRoutes);
    await api.register(devicesRoutes);
    await api.register(telemetryRoutes);
    await api.register(fleetRoutes);
  }, { prefix: '/api/v1' });

  return app;
}

export default buildApp;
