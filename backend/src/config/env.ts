import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'supersecret_jwt_key_smart_containers_2026',
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost',
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
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
