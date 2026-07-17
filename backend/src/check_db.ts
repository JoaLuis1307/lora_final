import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('[SEED] Asegurando que los gateways principales existan en la base de datos...');
    
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
    console.log('[SEED] Gateway 01 verificado/creado.');

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
    console.log('[SEED] Gateway 02 verificado/creado.');

    const devices = await prisma.device.findMany({
      orderBy: { id: 'asc' }
    });
    console.log('=== DISPOSITIVOS EN BASE DE DATOS ===');
    console.dir(devices, { depth: null });
  } catch (err) {
    console.error('Error querying/seeding DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

