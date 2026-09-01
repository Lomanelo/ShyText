import { languageTagOf } from '../i18n/languages';
import i18n from '../i18n';

/** How close you must be to check in — and to stay checked in when you reopen. */
export const NEARBY_RADIUS_METERS = 100;
export const NEARBY_MAX_VENUES = 5;
export const CHECK_IN_RADIUS_METERS = NEARBY_RADIUS_METERS;
/** Treat a GPS fix as precise enough to rank 100 m places. */
export const PRECISE_ACCURACY_METERS = 25;

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
  const tag = languageTagOf(i18n.language);
  try {
    if (meters < 1000) {
      return new Intl.NumberFormat(tag, {
        style: 'unit',
        unit: 'meter',
        unitDisplay: 'short',
        maximumFractionDigits: 0,
      }).format(Math.round(meters));
    }
    return new Intl.NumberFormat(tag, {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(meters / 1000);
  } catch {
    if (meters < 10) return `${meters.toFixed(0)} m`;
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

export function pickClosest<T extends { distanceMeters: number }>(
  items: T[],
  radiusMeters = NEARBY_RADIUS_METERS,
  limit = NEARBY_MAX_VENUES
): T[] {
  return [...items]
    .filter((item) => Number.isFinite(item.distanceMeters) && item.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
