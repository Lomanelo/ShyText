import * as Localization from 'expo-localization';
import countries from '../data/countries.json';
import citiesByCountry from '../data/cities-by-country.json';

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
  return `${Math.round(meters)} m`;
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

export type CountryOption = { code: string; name: string };
export type CityOption = { id: string; name: string };

const CITY_MAP = citiesByCountry as Record<string, string[]>;

export function listCountries(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    try {
      names = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      names = null;
    }
  }
  return (countries as string[])
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
    }))
    .filter((item) => item.name && item.name !== item.code)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function listCities(countryCode: string): CityOption[] {
  const list = CITY_MAP[countryCode] ?? [];
  return list.map((name) => ({ id: `${countryCode}:${name}`, name }));
}

export function defaultCountryCode(): string {
  return Localization.getLocales()[0]?.regionCode || 'US';
}

/** Resolve an ISO code from a previously stored display name (legacy private profiles). */
export function countryCodeFromName(name: string | undefined, locale: string): string | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return listCountries(locale).find((c) => c.name.toLowerCase() === needle)?.code;
}
