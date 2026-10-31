import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function seedDefaultData(prisma: PrismaClient) {
  try {
    // 1. Clean up any orphaned map points from the database (points with no devices linked)
    await prisma.mapPoint.deleteMany({
      where: {
        devices: {
          none: {}
        }
      }
    });
    console.log('[DATABASE] Puntos de mapa huérfanos eliminados.');

    // 2. Upsert Gateway 01
    await prisma.device.upsert({
      where: { device_id: 'gateway_01' },
      update: {},
      create: {
        device_id: 'gateway_01',
        name: 'Gateway Principal LoRa',
        type: 'Gateway',
        status: 'Online',
        latitude: -16.3950,
        longitude: -71.5400,
        battery_level: 100,
        signal_strength: -40,
        last_seen: new Date(),
        mac_address: 'AA:BB:CC:DD:EE:01',
        registered: true
      }
    });
    console.log('[DATABASE] Seaseed/Verify gateway_01 en base de datos.');

    // Remove legacy simulator records from production.
    await prisma.device.deleteMany({
      where: { device_id: { in: ['gateway_02', 'n2'] } }
    });
    await prisma.mapPoint.deleteMany({
      where: { name: { in: ['Contenedor Av. Ejército C-4', 'Contenedor Calle Mercaderes'] } }
    });
    console.log('[DATABASE] Registros virtuales heredados eliminados.');

    // 4. Find or create default MapPoints to link sensor nodes
    let p1 = await prisma.mapPoint.findFirst({
      where: { name: 'Punto Limpio Plaza Yanahuara' }
    });
    if (!p1) {
      p1 = await prisma.mapPoint.create({
        data: {
          name: 'Punto Limpio Plaza Yanahuara',
          latitude: -16.3888,
          longitude: -71.5415,
          type: 'Reciclaje',
          description: 'Contenedor inteligente de vidrio y plástico'
        }
      });
    }

    // 4. Seed the legacy N1 point only when it is already part of the deployment.
    await prisma.device.upsert({
      where: { device_id: 'n1' },
      update: {},
      create: {
        device_id: 'n1',
        name: 'Contenedor Plaza Yanahuara',
        type: 'Nodo Sensor',
        status: 'Online',
        latitude: -16.3888,
        longitude: -71.5415,
        battery_level: 84,
        signal_strength: -75,
        last_seen: new Date(),
        mac_address: '24:0A:C4:8B:58:AA',
        registered: true,
        map_point_id: p1.id,
        gateway_id: 'gateway_01'
      }
    });

    console.log('[DATABASE] Seeding del gateway físico completado.');
  } catch (err) {
    console.error('[DATABASE] Error seeding default data:', err);
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (fastify, opts) => {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  await prisma.$connect();

  // Run seeding for the physical gateway only
  await seedDefaultData(prisma);

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    await server.prisma.$disconnect();
  });
});

export default prismaPlugin;
export { prismaPlugin };
