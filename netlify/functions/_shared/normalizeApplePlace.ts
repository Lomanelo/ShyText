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
  const seen = new Set<string>();
  return venues
    .filter((venue) => {
      if (venue.distanceMeters > maxDistanceMeters) return false;
      if (seen.has(venue.providerPlaceId)) return false;
      seen.add(venue.providerPlaceId);
      return true;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
