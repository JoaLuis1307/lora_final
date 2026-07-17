import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { devicesService } from '../modules/devices/devices.service';

const watchdogPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Check inactivity every 10 seconds
  const CHECK_INTERVAL_MS = 10000;
  
  // Timeout thresholds
  const NODE_TIMEOUT_MS = 30000; // 30 seconds
  const GATEWAY_TIMEOUT_MS = 60000; // 60 seconds (since simulated gateway transmits every 30s)

  const checkInactivity = async () => {
    try {
      const devices = await devicesService.getDevices(fastify);
      const now = new Date();

      for (const device of devices) {
        if (!device.last_seen) continue;
        
        // Skip devices that are already offline or configuring
        if (device.status === 'Offline' || device.status === 'Configuring' || device.status === 'offline') {
          continue;
        }

        const lastSeenDate = new Date(device.last_seen);
        const elapsed = now.getTime() - lastSeenDate.getTime();
        const threshold = device.type === 'Gateway' ? GATEWAY_TIMEOUT_MS : NODE_TIMEOUT_MS;

        if (elapsed > threshold) {
          fastify.log.warn(`[WATCHDOG] Dispositivo [${device.device_id}] (${device.type}) inactivo por ${Math.round(elapsed / 1000)}s (umbral: ${threshold / 1000}s). Marcando como Offline.`);
          
          // Update device status in DB and broadcast.
          // Explicitly pass the original last_seen to avoid overwriting it!
          await devicesService.updateDevice(fastify, device.device_id, {
            status: 'Offline',
            last_seen: device.last_seen
          });
        }
      }
    } catch (err) {
      fastify.log.error(`[WATCHDOG] Error al verificar inactividad de dispositivos: ${err}`);
    }
  };

  let interval: NodeJS.Timeout | null = null;

  // Schedule check to run after Fastify server starts listening
  fastify.ready(() => {
    fastify.log.info('[WATCHDOG] Iniciando servicio de detección de inactividad...');
    interval = setInterval(checkInactivity, CHECK_INTERVAL_MS);
  });

  fastify.addHook('onClose', async () => {
    if (interval) {
      clearInterval(interval);
    }
    fastify.log.info('[WATCHDOG] Servicio de detección de inactividad detenido.');
  });
});

export default watchdogPlugin;
export { watchdogPlugin };
