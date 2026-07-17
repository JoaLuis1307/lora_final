import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function seedDefaultGateways(prisma: PrismaClient) {
  try {
    // Upsert Gateway 01
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

    // Upsert Gateway 02
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
  } catch (err) {
    console.error('[DATABASE] Error seeding default gateways:', err);
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (fastify, opts) => {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  await prisma.$connect();

  // Run seeding to ensure gateway_01 and gateway_02 exist
  await seedDefaultGateways(prisma);

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    await server.prisma.$disconnect();
  });
});

export default prismaPlugin;
export { prismaPlugin };

