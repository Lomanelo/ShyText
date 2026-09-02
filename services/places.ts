import { Venue, VenueCandidate, PlacesProvider, PlacesRequestError } from '../types/venue';
import { distanceBetween, pickClosest } from '../utils/geo';
import { isDevToolsEnabled } from '../utils/config';
import { DEMO_VENUES } from './mockData';
import i18n from '../i18n';
import { languageTagOf } from '../i18n/languages';

export const PADDYS_CORNER_ID = 'demo-paddys-corner';

const CACHE_TTL_MS = 45 * 1000;
const MOVE_THRESHOLD_M = 20;

type CacheEntry = {
  latitude: number;
  longitude: number;
  query: string;
  at: number;
  venues: VenueCandidate[];
};

let cache: CacheEntry | null = null;

function cacheHit(latitude: number, longitude: number, query: string) {
  if (!cache || cache.query !== query) return null;
  if (Date.now() - cache.at > CACHE_TTL_MS) return null;
  if (distanceBetween(latitude, longitude, cache.latitude, cache.longitude) > MOVE_THRESHOLD_M) {
    return null;
  }
  return cache.venues;
}

function remember(latitude: number, longitude: number, query: string, venues: VenueCandidate[]) {
  cache = { latitude, longitude, query, at: Date.now(), venues };
}

class DemoPlacesProvider implements PlacesProvider {
  async getNearbyVenues(latitude: number, longitude: number): Promise<VenueCandidate[]> {
    const ranked = DEMO_VENUES.map((venue) => ({
      provider: 'demo' as const,
      providerPlaceId: venue.providerPlaceId,
      name: venue.name,
      address: venue.address,
      category: venue.category,
      latitude: venue.latitude ?? latitude,
      longitude: venue.longitude ?? longitude,
      distanceMeters: distanceBetween(
        latitude,
        longitude,
        venue.latitude ?? latitude,
        venue.longitude ?? longitude
      ),
    }));
    return pickClosest(ranked);
  }

  async searchVenues(query: string, latitude: number, longitude: number) {
    const q = query.trim().toLowerCase();
    const nearby = await this.getNearbyVenues(latitude, longitude);
    return nearby.filter((venue) => venue.name.toLowerCase().includes(q));
  }
}

class PlacesProxyProvider implements PlacesProvider {
  constructor(private endpoint: string) {}

  private async request(latitude: number, longitude: number, query?: string) {
    const cached = cacheHit(latitude, longitude, query ?? '');
    if (cached) return cached;

    const url = new URL(this.endpoint);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lng', String(longitude));
    url.searchParams.set('lang', languageTagOf(i18n.language));
    if (query) url.searchParams.set('q', query);

    const response = await fetch(url.toString());
    if (response.status === 429) {
      throw new PlacesRequestError(i18n.t('errors.placesBusy'), 429, 'rate_limited');
    }
    if (response.status === 401 || response.status === 501) {
      throw new PlacesRequestError(i18n.t('errors.placesUnavailable'), response.status, 'places_auth');
    }
    if (!response.ok) {
      throw new PlacesRequestError(i18n.t('errors.placesLoad'), response.status, 'places_request');
    }
    const payload = (await response.json()) as VenueCandidate[] | { error?: string };
    if (!Array.isArray(payload)) {
      throw new PlacesRequestError(payload.error || i18n.t('errors.placesLoad'));
    }
    const venues = pickClosest(
      payload
        .filter(
          (item) =>
            item &&
            (item.provider === 'serper' || item.provider === 'google' || item.provider === 'apple') &&
            typeof item.providerPlaceId === 'string' &&
            typeof item.name === 'string' &&
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude)
        )
        .map((item) => ({
          ...item,
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
          distanceMeters: distanceBetween(latitude, longitude, item.latitude, item.longitude),
        }))
    );
    remember(latitude, longitude, query ?? '', venues);
    return venues;
  }

  async getNearbyVenues(latitude: number, longitude: number) {
    return this.request(latitude, longitude);
  }

  async searchVenues(query: string, latitude: number, longitude: number) {
    return this.request(latitude, longitude, query.trim());
  }
}

export function isPlacesConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_PLACES_PROXY_URL?.trim());
}

export function getPlacesProvider(): PlacesProvider {
  const endpoint = process.env.EXPO_PUBLIC_PLACES_PROXY_URL?.trim();
  if (endpoint) return new PlacesProxyProvider(endpoint);
  if (isDevToolsEnabled()) return new DemoPlacesProvider();
  return {
    getNearbyVenues: async () => [],
    searchVenues: async () => [],
  };
}

export function demoCandidates(latitude: number, longitude: number) {
  return new DemoPlacesProvider().getNearbyVenues(latitude, longitude);
}

export function candidateListKey(venue: VenueCandidate | Venue) {
  if ('id' in venue && venue.id) return venue.id;
  return `${venue.provider}:${venue.providerPlaceId}`;
}
