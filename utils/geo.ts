export const CHECK_IN_RADIUS_METERS = 150;

export function distanceBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinCheckInRadius(
  userLat: number,
  userLon: number,
  venueLat: number,
  venueLon: number,
  radius = CHECK_IN_RADIUS_METERS
): boolean {
  return distanceBetween(userLat, userLon, venueLat, venueLon) <= radius;
}

export function formatDistance(meters?: number): string {
  if (meters == null || Number.isNaN(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
