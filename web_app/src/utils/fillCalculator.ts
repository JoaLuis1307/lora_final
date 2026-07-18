/**
 * Utility helper to calculate the fill percentage of a container
 * based on the user-configured container height and full-distance threshold.
 */
export const calculateFillPercentage = (distance: number | undefined): number => {
  if (distance === undefined || distance === null) return 0;

  // Retrieve user settings from localStorage (defaults: height = 100cm, fullDist = 10cm)
  const heightSetting = localStorage.getItem('container_height');
  const fullSetting = localStorage.getItem('container_full_distance');
  
  const height = heightSetting ? parseFloat(heightSetting) : 100;
  const fullDist = fullSetting ? parseFloat(fullSetting) : 10;

  // If the measured distance is larger than the container height,
  // it is out of range/empty. We set it to 5% (less than 10% as requested).
  if (distance > height) {
    return 5;
  }

  // If the measured distance is extremely close to the sensor, the container is full.
  if (distance <= fullDist) {
    return 100;
  }

  // Linear calibration: (height - distance) / (height - fullDistance)
  const fill = Math.round(((height - distance) / (height - fullDist)) * 100);
  return Math.max(0, Math.min(100, fill));
};
