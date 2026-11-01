/**
 * Utility helper to calculate the fill percentage of a container
 * based on the user-configured container height and full-distance threshold.
 */
export const MAX_VALID_DISTANCE_CM = 130;

const isPlausibleDistance = (value: number): boolean =>
  Number.isFinite(value) && value > 0 && value <= MAX_VALID_DISTANCE_CM;

export const calculateFillPercentage = (distance: number | undefined): number => {
  if (distance === undefined || distance === null || !Number.isFinite(distance)) return 0;

  // Si la distancia medida sale de rango (<= 0 o > 130 cm), retornamos -1 (fuera de rango)
  if (distance <= 0 || distance > MAX_VALID_DISTANCE_CM) {
    return -1;
  }

  // Retrieve user settings from localStorage (defaults: height = 100cm, fullDist = 10cm)
  const heightSetting = typeof localStorage !== 'undefined' ? localStorage.getItem('container_height') : null;
  const fullSetting = typeof localStorage !== 'undefined' ? localStorage.getItem('container_full_distance') : null;

  const parsedHeight = heightSetting ? parseFloat(heightSetting) : NaN;
  const parsedFull = fullSetting ? parseFloat(fullSetting) : NaN;

  // Guard against missing, NaN, zero or negative calibration values.
  const height = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 100;
  let fullDist = Number.isFinite(parsedFull) && parsedFull >= 0 ? parsedFull : 10;
  if (fullDist >= height) fullDist = Math.max(0, height * 0.1);

  // If the measured distance is larger than the container height,
  // it is out of range/empty. We set it to 5% (less than 10% as requested).
  if (distance > height) {
    return 5;
  }

  // If the measured distance is extremely close to the sensor, the container is full.
  if (distance <= fullDist) {
    return 100;
  }

  const span = height - fullDist;
  if (span <= 0) return 100;

  // Linear calibration: (height - distance) / (height - fullDistance)
  const fill = Math.round(((height - distance) / span) * 100);
  return Math.max(0, Math.min(100, fill));
};

export const getValidFillDistance = (telemetry: {
  tof_cm?: number | null;
  ultrasonic_cm?: number | null;
  fill?: number | null;
} | undefined): number | undefined => {
  if (!telemetry) return undefined;
  // El ultrasonido es la fuente principal del nivel porque el laser del
  // VL53L0X se refleja mal en el agua. El ToF queda como respaldo.
  const ultrasonic = Number(telemetry.ultrasonic_cm);
  if (isPlausibleDistance(ultrasonic)) return ultrasonic;
  const tof = Number(telemetry.tof_cm);
  if (isPlausibleDistance(tof)) return tof;
  return undefined;
};
