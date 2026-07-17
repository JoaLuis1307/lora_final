import { buildApp } from './app';
import { config } from './config/env';
import { influxService } from './db/influx';

async function start() {
  try {
    // Automatically push schema to PostgreSQL if in PRISMA mode on boot
    if (config.db.mode === 'prisma') {
      console.log('[DATABASE] Sincronizando estructura de base de datos automáticamente...');
      try {
        const { execSync } = require('child_process');
        execSync('npx prisma db push', { stdio: 'inherit' });
        console.log('[DATABASE] ¡Estructura de base de datos sincronizada con éxito!');
      } catch (err) {
        console.error('[DATABASE] Advertencia: No se pudo sincronizar automáticamente la base de datos.', err);
      }
    }

    const app = await buildApp();

    await app.listen({ port: config.port, host: config.host });

    console.log(`
==================================================================
   🚀 SMART CONTAINERS BACKEND RESTACKED & READY! 🚀
==================================================================
   * Server Running at : http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}
   * API V1 Base Base   : http://localhost:${config.port}/api/v1
   * Database Mode     : [${config.db.mode.toUpperCase()}]
   * MQTT Ingestion    : ACTIVE
==================================================================
    `);

    // Graceful Shutdown Handlers
    const shutdown = async (signal: string) => {
      app.log.info(`[SERVER] Recibida señal ${signal}. Iniciando apagado ordenado...`);
      try {
        await app.close();
        await influxService.close();
        app.log.info('[SERVER] Apagado ordenado finalizado con éxito.');
        process.exit(0);
      } catch (err) {
        app.log.error(`[SERVER] Error durante el proceso de apagado: ${err}`);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[SERVER] Error crítico durante el arranque:', err);
    process.exit(1);
  }
}

start();
