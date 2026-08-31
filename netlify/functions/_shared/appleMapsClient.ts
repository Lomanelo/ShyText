import { getAppleMapsAccessToken } from './appleMapsAuth';
import { searchRegionBox } from './geo';
import {
  ApplePlace,
  SOCIAL_POI_CATEGORIES,
  dedupeAndRank,
  normalizeApplePlace,
  type VenueCandidate,
} from './normalizeApplePlace';

const SEARCH_URL = 'https://maps-api.apple.com/v1/search';
const NEARBY_RADIUS_M = 600;
const MAX_DISTANCE_M = 800;

type SearchResponse = {
  results?: ApplePlace[];
  places?: ApplePlace[];
};

function asPlacesError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function appleSearch(params: URLSearchParams) {
  const token = await getAppleMapsAccessToken();
  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 429) {
    throw asPlacesError('Venue search is busy right now. Try again in a moment.', 429);
  }
  if (response.status === 401) {
    throw asPlacesError('Apple Maps authentication failed.', 401);
  }
  if (!response.ok) {
    throw asPlacesError('Could not load nearby venues.', 502);
  }
  const payload = (await response.json()) as SearchResponse;
  return payload.results ?? payload.places ?? [];
}

function baseParams(latitude: number, longitude: number, query: string) {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('searchLocation', `${latitude},${longitude}`);
  params.set('userLocation', `${latitude},${longitude}`);
  params.set('searchRegion', searchRegionBox(latitude, longitude, NEARBY_RADIUS_M));
  params.set('resultTypeFilter', 'Poi');
  params.set('includePoiCategories', SOCIAL_POI_CATEGORIES.join(','));
  params.set('lang', 'en-US');
  return params;
}

export async function searchAppleVenues(
  latitude: number,
  longitude: number,
  query?: string
): Promise<VenueCandidate[]> {
  const q = query?.trim();
  const searches = [
    appleSearch(baseParams(latitude, longitude, q || 'cafe restaurant bar park museum hotel')),
  ];

  const pages = await Promise.all(searches);
  const venues = pages
    .flat()
    .map((place) => normalizeApplePlace(place, latitude, longitude))
    .filter((item): item is VenueCandidate => item != null);

  return dedupeAndRank(venues, q ? 4_000 : MAX_DISTANCE_M, q ? 20 : 20);
}
