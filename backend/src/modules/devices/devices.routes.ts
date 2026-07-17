import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { Device, MapPoint, RouteData } from '../../db/db';
import { devicesService } from './devices.service';
import { 
  createDeviceSchema, 
  updateDeviceSchema, 
  createMapPointSchema, 
  updateMapPointSchema, 
  createRouteSchema 
} from './devices.schema';

export async function devicesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  
  // ============================================================
  // DEVICES ENDPOINTS
  // ============================================================

  // 0. GET /devices/discovered - List all discovered but unregistered devices
  fastify.get('/devices/discovered', async (request, reply) => {
    try {
      const discovered = await devicesService.getDiscoveredDevices(fastify);
      return discovered;
    } catch (error: any) {
      request.log.error('Error fetching discovered devices:', error);
      return reply.status(500).send({ error: 'Failed to retrieve discovered devices', message: error.message });
    }
  });

  // 1. GET /devices - List all registered devices
  fastify.get('/devices', async (request, reply) => {
    try {
      const devices = await devicesService.getDevices(fastify);
      return devices;
    } catch (error: any) {
      request.log.error('Error fetching devices:', error);
      return reply.status(500).send({ error: 'Failed to retrieve devices', message: error.message });
    }
  });

  // 2. POST /devices - Register a new device manually
  fastify.post('/devices', { schema: createDeviceSchema }, async (request, reply) => {
    try {
      const deviceData = request.body as Partial<Device>;
      const newDevice = await devicesService.saveDevice(fastify, deviceData);
      
      // If registering a node, attempt to send a ping command through MQTT
      if (newDevice.type === 'Nodo Sensor') {
        const gatewayId = 'gateway_02'; // Default gateway for virtual/simulator
        fastify.mqtt.publishCommand(gatewayId, newDevice.device_id, { cmd: 'ping' });
      }

      return reply.status(201).send(newDevice);
    } catch (error: any) {
      request.log.error('Error registering device:', error);
      return reply.status(500).send({ error: 'Failed to register device', message: error.message });
    }
  });

  // 3. PATCH /devices/:deviceId - Update device properties
  fastify.patch('/devices/:deviceId', { schema: updateDeviceSchema }, async (request, reply) => {
    try {
      const { deviceId } = request.params as { deviceId: string };
      const updates = request.body as Partial<Device>;

      const updatedDevice = await devicesService.updateDevice(fastify, deviceId, updates);
      
      // If updating interval via frontend, transmit to physical/simulated hardware via MQTT command
      if (updates.status === 'Configuring') {
        fastify.mqtt.publishCommand('gateway_02', deviceId, { cmd: 'request' });
      }

      return updatedDevice;
    } catch (error: any) {
      request.log.error(`Error updating device ${request.params}:`, error);
      return reply.status(500).send({ error: 'Failed to update device', message: error.message });
    }
  });

  // 4. DELETE /devices/:deviceId - Delete a device registration
  fastify.delete('/devices/:deviceId', async (request, reply) => {
    try {
      const { deviceId } = request.params as { deviceId: string };
      await devicesService.deleteDevice(fastify, deviceId);
      return { success: true, message: `Device ${deviceId} deleted successfully` };
    } catch (error: any) {
      request.log.error(`Error deleting device ${request.params}:`, error);
      return reply.status(500).send({ error: 'Failed to delete device', message: error.message });
    }
  });

  // 5. POST /devices/:deviceId/command - Send custom MQTT command to node
  fastify.post('/devices/:deviceId/command', async (request, reply) => {
    try {
      const { deviceId } = request.params as { deviceId: string };
      const body = request.body as { cmd: string; value?: any; gateway_id?: string };

      if (!body.cmd) {
        return reply.status(400).send({ error: 'Bad Request', message: 'cmd is required in body' });
      }

      const gatewayId = body.gateway_id || 'gateway_02'; // Default simulator gateway
      const success = fastify.mqtt.publishCommand(gatewayId, deviceId, { cmd: body.cmd, value: body.value });

      if (success) {
        return { success: true, message: `Command '${body.cmd}' dispatched to device ${deviceId} via ${gatewayId}` };
      } else {
        return reply.status(503).send({ error: 'Service Unavailable', message: 'MQTT client is disconnected' });
      }
    } catch (error: any) {
      request.log.error('Error dispatching device command:', error);
      return reply.status(500).send({ error: 'Failed to dispatch command', message: error.message });
    }
  });

  // ============================================================
  // MAP POINTS ENDPOINTS
  // ============================================================

  // 6. GET /map-points - List all map points
  fastify.get('/map-points', async (request, reply) => {
    try {
      const points = await devicesService.getMapPoints(fastify);
      return points;
    } catch (error: any) {
      request.log.error('Error fetching map points:', error);
      return reply.status(500).send({ error: 'Failed to retrieve map points', message: error.message });
    }
  });

  // 7. POST /map-points - Create a new map point
  fastify.post('/map-points', { schema: createMapPointSchema }, async (request, reply) => {
    try {
      const pointData = request.body as Omit<MapPoint, 'id' | 'created_at'>;
      const newPoint = await devicesService.saveMapPoint(fastify, pointData);
      return reply.status(201).send(newPoint);
    } catch (error: any) {
      request.log.error('Error creating map point:', error);
      return reply.status(500).send({ error: 'Failed to create map point', message: error.message });
    }
  });

  // 8. PUT /map-points/:id - Update an existing map point
  fastify.put('/map-points/:id', { schema: updateMapPointSchema }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const pointUpdates = request.body as Partial<MapPoint>;
      const numericId = parseInt(id, 10);

      if (isNaN(numericId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'ID must be a numeric value' });
      }

      const updatedPoint = await devicesService.updateMapPoint(fastify, numericId, pointUpdates);
      return updatedPoint;
    } catch (error: any) {
      request.log.error(`Error updating map point ${request.params}:`, error);
      return reply.status(500).send({ error: 'Failed to update map point', message: error.message });
    }
  });

  // 9. DELETE /map-points/:id - Delete a map point
  fastify.delete('/map-points/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const numericId = parseInt(id, 10);

      if (isNaN(numericId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'ID must be a numeric value' });
      }

      await devicesService.deleteMapPoint(fastify, numericId);
      return { success: true, message: `Map point with ID ${numericId} deleted successfully` };
    } catch (error: any) {
      request.log.error(`Error deleting map point ${request.params}:`, error);
      return reply.status(500).send({ error: 'Failed to delete map point', message: error.message });
    }
  });

  // ============================================================
  // COLLECTION ROUTES ENDPOINTS
  // ============================================================

  // 10. GET /routes - List all collection routes
  fastify.get('/routes', async (request, reply) => {
    try {
      const routes = await devicesService.getRoutes(fastify);
      return routes;
    } catch (error: any) {
      request.log.error('Error fetching collection routes:', error);
      return reply.status(500).send({ error: 'Failed to retrieve routes', message: error.message });
    }
  });

  // 11. POST /routes - Save a new collection route
  fastify.post('/routes', { schema: createRouteSchema }, async (request, reply) => {
    try {
      const routeData = request.body as RouteData;
      const newRoute = await devicesService.saveRoute(fastify, routeData);
      return reply.status(201).send(newRoute);
    } catch (error: any) {
      request.log.error('Error saving collection route:', error);
      return reply.status(500).send({ error: 'Failed to save route', message: error.message });
    }
  });

  // 12. DELETE /routes/:id - Delete a collection route by ID
  fastify.delete('/routes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const numericId = parseInt(id, 10);

      if (isNaN(numericId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'ID must be a numeric value' });
      }

      await devicesService.deleteRoute(fastify, numericId);
      return { success: true, message: `Route with ID ${numericId} deleted successfully` };
    } catch (error: any) {
      request.log.error(`Error deleting route ${request.params}:`, error);
      return reply.status(500).send({ error: 'Failed to delete route', message: error.message });
    }
  });
}
export default devicesRoutes;
export { devicesRoutes as devicesModule };
