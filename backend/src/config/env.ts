import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
};

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret) {
  console.warn('[CONFIG] JWT_SECRET no está configurado; use un secreto propio antes de producción.');
}

export const config = {
  port: parsePort(process.env.PORT, 3001),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: jwtSecret || 'development-only-change-me',
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost',
    port: parsePort(process.env.MQTT_PORT, 1883),
    username: process.env.MQTT_USER || undefined,
    password: process.env.MQTT_PASS || undefined,
  },
  db: {
    mode: (
      process.env.DB_MODE?.toLowerCase() === 'supabase'
        ? 'supabase'
        : process.env.DB_MODE?.toLowerCase() === 'prisma'
        ? 'prisma'
        : 'local'
    ) as 'local' | 'supabase' | 'prisma',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || '',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_containers?schema=public',
  },
  influx: {
    url: process.env.INFLUX_URL || '',
    token: process.env.INFLUX_TOKEN || '',
    org: process.env.INFLUX_ORG || '',
    bucket: process.env.INFLUX_BUCKET || '',
  }
};

// Console logger to indicate which database mode we are running in
console.log(`[CONFIG] Base de datos corriendo en MODO: ${config.db.mode.toUpperCase()}`);

if (config.db.mode === 'supabase' && (!config.db.supabaseUrl || !config.db.supabaseKey)) {
  console.warn('[WARNING] Se seleccionó el modo SUPABASE pero faltan SUPABASE_URL o SUPABASE_KEY. Usando fallback LOCAL.');
  config.db.mode = 'local';
}

if (config.db.mode === 'prisma' && !config.db.databaseUrl) {
  console.warn('[WARNING] Se seleccionó el modo PRISMA pero falta DATABASE_URL. Usando fallback LOCAL.');
  config.db.mode = 'local';
}
