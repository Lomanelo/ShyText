import { distanceBetween } from './geo';

export const SOCIAL_POI_CATEGORIES = [
  'Cafe',
  'Restaurant',
  'Nightlife',
  'Brewery',
  'Bakery',
  'Hotel',
  'Park',
  'MusicVenue',
  'MovieTheater',
  'Bowling',
  'FitnessCenter',
  'ConventionCenter',
  'Museum',
  'Fairground',
  'AmusementPark',
  'Library',
  'Theater',
  'Stadium',
  'Winery',
  'Distillery',
  'University',
] as const;

export const EXCLUDED_POI_CATEGORIES = new Set([
  'ATM',
  'Bank',
  'GasStation',
  'AutomotiveRepair',
  'FireStation',
  'Hospital',
  'Parking',
  'Mailbox',
  'Police',
  'Restroom',
  'Pharmacy',
  'EVCharger',
  'PostOffice',
  'CarRental',
  'Laundry',
]);

export type VenueCandidate = {
  provider: 'apple';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

export type ApplePlace = {
  id?: string;
  muid?: string | number;
  name?: string;
  poiCategory?: string;
  formattedAddressLines?: string[];
  coordinate?: { latitude?: number; longitude?: number };
  center?: { latitude?: number; longitude?: number };
};

export function normalizeApplePlace(
  place: ApplePlace,
  userLat: number,
  userLon: number
): VenueCandidate | null {
  const name = place.name?.trim();
  const latitude = place.coordinate?.latitude ?? place.center?.latitude;
  const longitude = place.coordinate?.longitude ?? place.center?.longitude;
  const providerPlaceId = place.id || (place.muid != null ? String(place.muid) : '');
  if (!name || latitude == null || longitude == null || !providerPlaceId) return null;

  const category = place.poiCategory;
  if (category && EXCLUDED_POI_CATEGORIES.has(category)) return null;

  return {
    provider: 'apple',
    providerPlaceId,
    name,
    address: place.formattedAddressLines?.filter(Boolean).join(', ') || undefined,
    category,
    latitude,
    longitude,
    distanceMeters: Math.round(distanceBetween(userLat, userLon, latitude, longitude)),
  };
}

export function dedupeAndRank(venues: VenueCandidate[], maxDistanceMeters: number, limit = 20) {
  const byId = new Map<string, VenueCandidate>();
  for (const venue of venues) {
    if (venue.distanceMeters > maxDistanceMeters) continue;
    const existing = byId.get(venue.providerPlaceId);
    if (!existing || venue.distanceMeters < existing.distanceMeters) {
      byId.set(venue.providerPlaceId, venue);
    }
  }

  // Apple often returns several POI IDs for one physical place (aliases, old names,
  // category echoes from multi-term search). Collapse near-identical coordinates.
  const ranked = [...byId.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const kept: VenueCandidate[] = [];

  for (const venue of ranked) {
    const duplicate = kept.find((item) => isSamePhysicalPlace(item, venue));
    if (duplicate) continue;
    kept.push(venue);
    if (kept.length >= limit) break;
  }

  return kept;
}

/** Same building / same door — not neighboring shops on a street. */
const CLUSTER_METERS = 22;
const ADDRESS_CLUSTER_METERS = 40;

function normalizeAddressKey(address?: string) {
  if (!address) return '';
  return address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeNameKey(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSamePhysicalPlace(a: VenueCandidate, b: VenueCandidate) {
  const meters = distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude);
  if (meters <= CLUSTER_METERS) return true;

  const addrA = normalizeAddressKey(a.address);
  const addrB = normalizeAddressKey(b.address);
  if (addrA && addrB && addrA === addrB && meters <= ADDRESS_CLUSTER_METERS) return true;

  const nameA = normalizeNameKey(a.name);
  const nameB = normalizeNameKey(b.name);
  if (nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA)) && meters <= ADDRESS_CLUSTER_METERS) {
    return true;
  }

  return false;
}
