import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { telemetryService } from './telemetry.service';
import { getHistorySchema } from './telemetry.schema';

export async function telemetryRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {

  // 1. GET /telemetry/latest - Get the most recent telemetry readings for all devices
  fastify.get('/telemetry/latest', async (request, reply) => {
    try {
      const latestTelemetry = await telemetryService.getLatestTelemetry(fastify);
      return latestTelemetry;
    } catch (error: any) {
      request.log.error('Error fetching latest telemetry:', error);
      return reply.status(500).send({ error: 'Failed to retrieve latest telemetry', message: error.message });
    }
  });

  // 2. GET /telemetry/history - Get timeline historical telemetry for a specific device
  // Query parameters: ?device_id=N1&range=24h (ranges supported: 1h, 6h, 24h, 7d)
  fastify.get('/telemetry/history', { schema: getHistorySchema }, async (request, reply) => {
    try {
      const { device_id, range } = request.query as { device_id: string; range: string };

      const history = await telemetryService.getTelemetryHistory(fastify, device_id, range);
      return history;
    } catch (error: any) {
      request.log.error(`Error fetching telemetry history for query ${JSON.stringify(request.query)}:`, error);
      return reply.status(500).send({ error: 'Failed to retrieve telemetry history', message: error.message });
    }
  });

  // 3. GET /telemetry/stats - Get all telemetry data organized by device
  // Query parameters: ?range=5m (ranges: 5m, 1h, 6h, 24h, 7d)
  fastify.get('/telemetry/stats', async (request, reply) => {
    try {
      const { range } = request.query as { range?: string };
      const stats = await telemetryService.getAllStats(fastify, range || '5m');
      return stats;
    } catch (error: any) {
      request.log.error('Error fetching telemetry stats:', error);
      return reply.status(500).send({ error: 'Failed to retrieve telemetry stats', message: error.message });
    }
  });
}

export default telemetryRoutes;
export { telemetryRoutes as telemetryModule };
