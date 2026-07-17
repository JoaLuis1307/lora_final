-- ======================================================================
-- SMART CONTAINERS IoT - ESQUEMA DE BASE DE DATOS PARA SUPABASE / POSTGRES
-- ======================================================================
-- Copia y pega este script en el editor SQL de Supabase para inicializar tus tablas.

-- 1. Tabla de Puntos de Mapa (Ubicaciones físicas de contenedores, puntos limpios, etc.)
CREATE TABLE IF NOT EXISTS map_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'General', 'Reciclaje', 'Papel/Cartón', etc.
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tabla de Dispositivos (Gateways LoRa y Nodos sensores)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL, -- 'N1', 'gateway_01', etc.
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'Gateway', 'Nodo Sensor'
    status VARCHAR(20) DEFAULT 'Configuring' NOT NULL, -- 'Online', 'Offline', 'Warning', 'Configuring'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    battery_level INTEGER DEFAULT 100 NOT NULL,
    signal_strength INTEGER DEFAULT -50 NOT NULL, -- RSSI del paquete
    last_seen TIMESTAMP WITH TIME ZONE,
    mac_address VARCHAR(30) UNIQUE,
    registered BOOLEAN DEFAULT TRUE NOT NULL,
    map_point_id INTEGER REFERENCES map_points(id) ON DELETE SET NULL
);

-- 3. Tabla de Historial de Telemetría (Datos transmitidos por los contenedores)
CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    sequence INTEGER NOT NULL,
    temperature NUMERIC(5,2) NOT NULL,
    humidity NUMERIC(5,2) NOT NULL,
    air_quality INTEGER NOT NULL, -- ADC raw
    ultrasonic_cm NUMERIC(6,2) NOT NULL,
    tof_cm NUMERIC(6,2) NOT NULL,
    obstacle INTEGER DEFAULT 0 NOT NULL, -- 0 o 1
    altitude NUMERIC(8,2) NOT NULL,
    satellites INTEGER NOT NULL,
    rssi INTEGER NOT NULL,
    snr NUMERIC(4,2) NOT NULL,
    pkts INTEGER NOT NULL,
    crc_ok INTEGER DEFAULT 1 NOT NULL,
    crc_err INTEGER DEFAULT 0 NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Tabla de Rutas de Recolección (Rutas optimizadas planificadas)
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    points JSONB NOT NULL, -- Formato: [[lat, lon], [lat, lon], ...]
    distance NUMERIC(6,2) NOT NULL, -- en km
    duration INTEGER NOT NULL, -- en minutos
    color VARCHAR(10) DEFAULT '#2dd4bf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ----------------------------------------------------------------------
-- Índices para optimización de consultas rápidas e históricos
-- ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp ON telemetry(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- ----------------------------------------------------------------------
-- Función RPC en Postgres para obtener la última telemetría eficientemente
-- ----------------------------------------------------------------------
-- Esta función RPC es llamada por el backend Fastify para obtener en una sola consulta
-- la medición más reciente de cada dispositivo sensor.
CREATE OR REPLACE FUNCTION get_latest_telemetry()
RETURNS SETOF telemetry AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (device_id) *
    FROM telemetry
    ORDER BY device_id, timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
