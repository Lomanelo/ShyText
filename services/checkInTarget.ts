import i18n from '../i18n';
import { Venue, VenueCandidate } from '../types/venue';
import { getPlacesProvider } from './places';
import { findVenuesByProviderPlaceIds, getVenue, toVenue } from './venues';

export function normalizeVenueQuery(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function hydrate(candidates: VenueCandidate[]): Promise<Venue[]> {
  const existing = await findVenuesByProviderPlaceIds(candidates.map((item) => item.providerPlaceId));
  return candidates.map((candidate) => toVenue(candidate, existing.get(candidate.providerPlaceId)?.id));
}

function dedupe(venues: Venue[]) {
  const seen = new Set<string>();
  return venues.filter((venue) => {
    const key = `${venue.provider}:${venue.providerPlaceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreName(venue: Venue, query: string) {
  const name = normalizeVenueQuery(venue.name);
  if (!query || !name) return 0;
  if (name === query) return 3;
  if (name.startsWith(query) || query.startsWith(name)) return 2;
  if (name.includes(query) || query.includes(name)) return 1;
  return 0;
}

export async function resolveCheckInVenue(input: {
  venueId?: string;
  name?: string;
  latitude: number;
  longitude: number;
}): Promise<Venue> {
  if (input.venueId) {
    const found = await getVenue(input.venueId);
    if (!found) throw new Error(i18n.t('errors.siriVenueNotFound', { name: input.venueId }));
    return found;
  }

  const provider = getPlacesProvider();
  const nearby = await hydrate(await provider.getNearbyVenues(input.latitude, input.longitude));
  const query = input.name?.trim();

  if (query) {
    const searched = provider.searchVenues
      ? await hydrate(await provider.searchVenues(query, input.latitude, input.longitude))
      : [];
    const needle = normalizeVenueQuery(query);
    const matches = dedupe([...searched, ...nearby])
      .map((venue) => ({ venue, score: scoreName(venue, needle) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.venue.distanceMeters ?? 9_999) - (b.venue.distanceMeters ?? 9_999));
    if (!matches.length) {
      throw new Error(i18n.t('errors.siriVenueNotFound', { name: query }));
    }
    return matches[0].venue;
  }

  if (!nearby.length) throw new Error(i18n.t('errors.siriNoNearby'));
  return nearby[0];
}
