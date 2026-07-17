import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { fleetService, VehicleData, MaintenanceLogData } from './fleet.service';

export async function fleetRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {

  // 1. GET /fleet/vehicles - Retrieve all vehicles in fleet
  fastify.get('/fleet/vehicles', async (request, reply) => {
    try {
      const list = await fleetService.getVehicles(fastify);
      return list;
    } catch (err: any) {
      request.log.error(`[FLEET] Error retrieving vehicles: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 1.5. GET /fleet/realtime - Retrieve real-time fleet data in custom format (mapped from MQTT updates)
  fastify.get('/fleet/realtime', async (request, reply) => {
    try {
      const list = await fleetService.getVehicles(fastify);
      
      const realTimeFleet = list.map(vehicle => {
        // Robust regex to extract latitude and longitude from location string
        const match = vehicle.location.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        let lat: number | null = null;
        let lng: number | null = null;
        
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
        }
        
        return {
          id: vehicle.id,
          nombre: vehicle.driver && vehicle.driver !== 'N/A' ? vehicle.driver : `Camión ${vehicle.id}`,
          capacidad: vehicle.capacity,
          velocidad: vehicle.speed,
          estado: vehicle.status,
          coordenada: lat !== null && lng !== null ? { lat, lng } : null,
          coordenada_raw: vehicle.location
        };
      });
      
      return realTimeFleet;
    } catch (err: any) {
      request.log.error(`[FLEET] Error generating real-time fleet API: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 2. POST /fleet/vehicles - Register new vehicle
  fastify.post('/fleet/vehicles', async (request, reply) => {
    try {
      const body = request.body as VehicleData;
      if (!body.id || !body.plate) {
        return reply.status(400).send({ error: 'Bad Request', message: 'id and plate are required' });
      }
      const vehicle = await fleetService.saveVehicle(fastify, body);
      return reply.status(201).send(vehicle);
    } catch (err: any) {
      request.log.error(`[FLEET] Error saving vehicle: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 3. PATCH /fleet/vehicles/:vehicleId - Update vehicle coordinates, speed, or fuel
  fastify.patch('/fleet/vehicles/:vehicleId', async (request, reply) => {
    try {
      const { vehicleId } = request.params as { vehicleId: string };
      const updates = request.body as Partial<VehicleData>;
      const updated = await fleetService.updateVehicle(fastify, vehicleId, updates);
      return updated;
    } catch (err: any) {
      request.log.error(`[FLEET] Error updating vehicle ${request.params}: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 4. DELETE /fleet/vehicles/:vehicleId - Delete vehicle registration
  fastify.delete('/fleet/vehicles/:vehicleId', async (request, reply) => {
    try {
      const { vehicleId } = request.params as { vehicleId: string };
      await fleetService.deleteVehicle(fastify, vehicleId);
      return { success: true, message: `Vehicle ${vehicleId} removed successfully` };
    } catch (err: any) {
      request.log.error(`[FLEET] Error deleting vehicle ${request.params}: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 5. GET /fleet/logs - Get operational alerts / logs
  fastify.get('/fleet/logs', async (request, reply) => {
    try {
      const list = await fleetService.getMaintenanceLogs(fastify);
      return list;
    } catch (err: any) {
      request.log.error(`[FLEET] Error retrieving logs: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });

  // 6. POST /fleet/logs - Register a new operational alert / maintenance log
  fastify.post('/fleet/logs', async (request, reply) => {
    try {
      const body = request.body as Omit<MaintenanceLogData, 'id'>;
      if (!body.vehicle_id || !body.description) {
        return reply.status(400).send({ error: 'Bad Request', message: 'vehicle_id and description are required' });
      }
      const log = await fleetService.saveMaintenanceLog(fastify, body);
      return reply.status(201).send(log);
    } catch (err: any) {
      request.log.error(`[FLEET] Error saving log: ${err}`);
      return reply.status(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });
}

export default fleetRoutes;
export { fleetRoutes as fleetModule };
