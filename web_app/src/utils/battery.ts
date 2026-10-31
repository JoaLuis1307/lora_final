/**
 * Resolves a battery percentage (0-100) from a telemetry payload.
 *
 * The backend exposes different battery representations depending on the
 * endpoint: `/telemetry/latest` and history return `battery` as VOLTAGE plus
 * `battery_pct` as state-of-charge, while WebSocket live frames override
 * `battery` with a percentage. This helper normalizes all of them.
 */
export interface BatteryLike {
  battery?: number | string | null;
  battery_pct?: number | string | null;
  battery_level?: number | string | null;
  batteryPercent?: number | string | null;
  bateria?: number | string | null;
  batt?: number | string | null;
  bat?: number | string | null;
  BATP?: number | string | null;
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clampPercent = (value: number): number => Math.round(Math.max(0, Math.min(100, value)));

/** Converts a Li-ion cell voltage (3.0V - 4.2V) to an approximate percentage. */
export const voltageToPercent = (voltage: number): number =>
  clampPercent(((voltage - 3.0) / (4.2 - 3.0)) * 100);

/**
 * @param telemetry Telemetry object from the API or WebSocket.
 * @param fallback  Value returned when no battery data is available.
 */
export const resolveBatteryPercent = (
  telemetry: BatteryLike | null | undefined,
  fallback: number = 100
): number => {
  if (!telemetry) return fallback;

  // 1. Explicit state-of-charge fields always win.
  const explicitPct = toFiniteNumber(
    telemetry.battery_pct ??
      telemetry.BATP ??
      telemetry.batteryPercent ??
      telemetry.bateria ??
      telemetry.batt ??
      telemetry.bat
  );
  if (explicitPct !== undefined) {
    // Legacy rows persisted battery_pct = 0 even when only voltage was known.
    const rawBattery = toFiniteNumber(telemetry.battery);
    if (explicitPct === 0 && rawBattery !== undefined && rawBattery > 0 && rawBattery <= 5) {
      return voltageToPercent(rawBattery);
    }
    return clampPercent(explicitPct);
  }

  // 2. `battery_level` is always a percentage.
  const level = toFiniteNumber(telemetry.battery_level);
  if (level !== undefined) return clampPercent(level);

  // 3. `battery` may be a percentage (>5) or a voltage (<=5).
  const battery = toFiniteNumber(telemetry.battery);
  if (battery !== undefined) {
    if (battery > 5) return clampPercent(battery);
    if (battery > 0) return voltageToPercent(battery);
  }

  return fallback;
};

/** Returns true when the telemetry contains any usable battery value. */
export const hasBatteryReading = (telemetry: BatteryLike | null | undefined): boolean => {
  if (!telemetry) return false;
  return (
    toFiniteNumber(telemetry.battery_pct) !== undefined ||
    toFiniteNumber(telemetry.BATP) !== undefined ||
    toFiniteNumber(telemetry.battery_level) !== undefined ||
    toFiniteNumber(telemetry.battery) !== undefined
  );
};
