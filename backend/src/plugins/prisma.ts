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
    // 1. Upsert Gateway 01
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

    // 2. Upsert Gateway 02
    await prisma.device.upsert({
      where: { device_id: 'gateway_02' },
      update: { name: 'Gateway Virtual' },
      create: {
        device_id: 'gateway_02',
        name: 'Gateway Virtual',
        type: 'Gateway',
        status: 'Online',
        latitude: -16.3988,
        longitude: -71.5368,
        battery_level: 100,
        signal_strength: -30,
        last_seen: new Date(),
        mac_address: '00:11:22:33:44:55',
        registered: true
      }
    });
    console.log('[DATABASE] Seaseed/Verify gateway_02 en base de datos.');

    // 3. Seed default MapPoints & Sensor Nodes if database is empty
    const pointsCount = await prisma.mapPoint.count();
    if (pointsCount === 0) {
      console.log('[DATABASE] Creando puntos de mapa y contenedores por defecto...');
      
      const p1 = await prisma.mapPoint.create({
        data: {
          name: 'Punto Limpio Plaza Yanahuara',
          latitude: -16.3888,
          longitude: -71.5415,
          type: 'Reciclaje',
          description: 'Contenedor inteligente de vidrio y plástico'
        }
      });

      const p2 = await prisma.mapPoint.create({
        data: {
          name: 'Contenedor Av. Ejército C-4',
          latitude: -16.3920,
          longitude: -71.5460,
          type: 'General',
          description: 'Contenedor de residuos generales de alta capacidad'
        }
      });

      await prisma.mapPoint.create({
        data: {
          name: 'Punto Ecológico Mall Plaza',
          latitude: -16.3980,
          longitude: -71.5520,
          type: 'Papel/Cartón',
          description: 'Contenedor inteligente para papel y cartón'
        }
      });

      await prisma.mapPoint.create({
        data: {
          name: 'Contenedor Calle Mercaderes',
          latitude: -16.3988,
          longitude: -71.5368,
          type: 'General',
          description: 'Ubicación central del simulador'
        }
      });

      // Seed sensor nodes N1 and N2 linked to points
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

      await prisma.device.upsert({
        where: { device_id: 'n2' },
        update: {},
        create: {
          device_id: 'n2',
          name: 'Contenedor Av. Ejército C-4',
          type: 'Nodo Sensor',
          status: 'Warning',
          latitude: -16.3920,
          longitude: -71.5460,
          battery_level: 42,
          signal_strength: -88,
          last_seen: new Date(),
          mac_address: '24:0A:C4:8B:58:BB',
          registered: true,
          map_point_id: p2.id,
          gateway_id: 'gateway_02'
        }
      });
      console.log('[DATABASE] Seeding de puntos de mapa y nodos de sensores completado.');
    }
  } catch (err) {
    console.error('[DATABASE] Error seeding default data:', err);
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (fastify, opts) => {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  await prisma.$connect();

  // Run seeding to ensure gateway_01 and gateway_02 exist
  await seedDefaultData(prisma);

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    await server.prisma.$disconnect();
  });
});

export default prismaPlugin;
export { prismaPlugin };

