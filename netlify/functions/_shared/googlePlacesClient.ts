import { distanceBetween } from './geo';
import { googleStreetViewConfigured } from './streetView';

const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const MAX_DISTANCE_M = 100;
const MAX_RESULTS = 5;
const CLUSTER_METERS = 22;

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.businessStatus',
].join(',');

/** Social venues people might Shyne at. */
const NEARBY_TYPES = [
  'cafe',
  'restaurant',
  'bar',
  'night_club',
  'bakery',
  'park',
  'library',
  'museum',
  'gym',
  'lodging',
  'movie_theater',
  'university',
  'book_store',
  'wine_bar',
];

export type VenueCandidate = {
  provider: 'google';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

type GooglePlace = {
  id?: string;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  displayName?: { text?: string };
};

type SearchResponse = { places?: GooglePlace[] };

export function googlePlacesConfigured() {
  return googleStreetViewConfigured();
}

function apiKey() {
  const key = Netlify.env.get('GOOGLE_MAPS_API_KEY')?.trim();
  if (!key) {
    throw Object.assign(new Error('Google Places is not configured.'), { status: 501 });
  }
  return key;
}

function categoryFromTypes(primaryType?: string, types?: string[]) {
  const ordered = [primaryType, ...(types ?? [])].filter(Boolean) as string[];
  for (const type of ordered) {
    if (type === 'cafe' || type === 'coffee_shop') return 'Cafe';
    if (type === 'bakery') return 'Bakery';
    if (type === 'bar' || type === 'pub' || type === 'wine_bar' || type === 'night_club') return 'Nightlife';
    if (type === 'restaurant' || type === 'meal_takeaway' || type === 'meal_delivery') return 'Restaurant';
    if (type === 'park') return 'Park';
    if (type === 'library' || type === 'university' || type === 'book_store') return 'Library';
    if (type === 'museum') return 'Museum';
    if (type === 'gym') return 'FitnessCenter';
    if (type === 'lodging' || type === 'hotel') return 'Hotel';
    if (type === 'movie_theater') return 'MovieTheater';
    if (type === 'performing_arts_theater') return 'Theater';
  }
  return ordered[0];
}

function normalizeGooglePlace(place: GooglePlace, userLat: number, userLon: number): VenueCandidate | null {
  const name = place.displayName?.text?.trim();
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const providerPlaceId = place.id?.trim();
  if (!name || latitude == null || longitude == null || !providerPlaceId) return null;

  const status = place.businessStatus;
  if (status && status !== 'OPERATIONAL') return null;

  const distanceMeters = Math.round(distanceBetween(userLat, userLon, latitude, longitude));
  if (distanceMeters > MAX_DISTANCE_M) return null;

  return {
    provider: 'google',
    providerPlaceId,
    name,
    address: place.formattedAddress,
    category: categoryFromTypes(place.primaryType, place.types),
    latitude,
    longitude,
    distanceMeters,
  };
}

function clusterAndRank(venues: VenueCandidate[]) {
  const byId = new Map<string, VenueCandidate>();
  for (const venue of venues) {
    const existing = byId.get(venue.providerPlaceId);
    if (!existing || venue.distanceMeters < existing.distanceMeters) {
      byId.set(venue.providerPlaceId, venue);
    }
  }

  const ranked = [...byId.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const kept: VenueCandidate[] = [];
  for (const venue of ranked) {
    const duplicate = kept.some(
      (item) => distanceBetween(item.latitude, item.longitude, venue.latitude, venue.longitude) <= CLUSTER_METERS
    );
    if (duplicate) continue;
    kept.push(venue);
    if (kept.length >= MAX_RESULTS) break;
  }
  return kept;
}

async function googlePost(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw Object.assign(new Error('Venue search is busy right now. Try again in a moment.'), { status: 429 });
  }
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Google Places authentication failed. Enable Places API (New) on this key.'), {
      status: 401,
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(new Error(detail.slice(0, 180) || 'Could not load nearby venues.'), { status: 502 });
  }

  return (await response.json()) as SearchResponse;
}

export async function searchGoogleVenues(
  latitude: number,
  longitude: number,
  query?: string,
  lang = 'en'
): Promise<VenueCandidate[]> {
  const q = query?.trim();
  const languageCode = lang.split('-')[0] || 'en';

  let payload: SearchResponse;
  if (q) {
    payload = await googlePost(TEXT_URL, {
      textQuery: q,
      languageCode,
      maxResultCount: MAX_RESULTS,
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: MAX_DISTANCE_M,
        },
      },
    });
  } else {
    payload = await googlePost(NEARBY_URL, {
      languageCode,
      maxResultCount: MAX_RESULTS,
      includedTypes: NEARBY_TYPES,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: MAX_DISTANCE_M,
        },
      },
    });
  }

  const venues = (payload.places ?? [])
    .map((place) => normalizeGooglePlace(place, latitude, longitude))
    .filter((item): item is VenueCandidate => item != null);

  return clusterAndRank(venues);
}
