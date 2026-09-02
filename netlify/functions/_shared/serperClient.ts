import { distanceBetween } from './geo';

const MAPS_URL = 'https://google.serper.dev/maps';
const IMAGES_URL = 'https://google.serper.dev/images';
const MAX_DISTANCE_M = 100;
const MAX_RESULTS = 8;
const CLUSTER_METERS = 22;
const NEARBY_QUERIES = ['cafe', 'bar', 'restaurant', 'pub', 'park', 'hotel'] as const;

export type VenueCandidate = {
  provider: 'serper';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  imageUrl?: string;
};

type SerperPlace = {
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  types?: string[];
  category?: string;
  placeId?: string;
  cid?: string;
  fid?: string;
  thumbnailUrl?: string;
};

type MapsResponse = {
  places?: SerperPlace[];
  credits?: number;
};

type ImageResult = {
  imageUrl?: string;
  thumbnailUrl?: string;
};

export function serperConfigured() {
  return Boolean(Netlify.env.get('SERPER_API_KEY')?.trim());
}

function apiKey() {
  const key = Netlify.env.get('SERPER_API_KEY')?.trim();
  if (!key) {
    throw Object.assign(new Error('Serper is not configured.'), { status: 501 });
  }
  return key;
}

function langParts(lang: string) {
  const tag = lang.trim() || 'en-US';
  const [hlRaw, region] = tag.split(/[-_]/);
  const hl = (hlRaw || 'en').toLowerCase();
  const gl = (region || hl).toLowerCase();
  return { hl, gl: gl.length === 2 ? gl : 'us' };
}

function categoryFromSerper(place: SerperPlace) {
  const ordered = [place.type, place.category, ...(place.types ?? [])].filter(Boolean) as string[];
  const blob = ordered.join(' ').toLowerCase();
  if (/caf[eé]|coffee|espresso/.test(blob)) return 'Cafe';
  if (/baker|boulang/.test(blob)) return 'Bakery';
  if (/night|club|bar|pub|bi[eè]re|cocktail|wine/.test(blob)) return 'Nightlife';
  if (/restaurant|bistro|brasserie|food|meal|tapas/.test(blob)) return 'Restaurant';
  if (/park|jardin|square|place/.test(blob)) return 'Park';
  if (/librar|biblioth|university|universit|campus|book/.test(blob)) return 'Library';
  if (/museum|mus[eé]e/.test(blob)) return 'Museum';
  if (/gym|fitness|sport/.test(blob)) return 'FitnessCenter';
  if (/hotel|lodging|hostel|auberge/.test(blob)) return 'Hotel';
  if (/cinema|movie|th[eé][aâ]tre|theater/.test(blob)) return 'MovieTheater';
  return ordered[0];
}

function placeIdOf(place: SerperPlace) {
  return place.placeId?.trim() || place.cid?.trim() || place.fid?.trim() || '';
}

function normalizePlace(place: SerperPlace, userLat: number, userLon: number): VenueCandidate | null {
  const name = place.title?.trim();
  const latitude = place.latitude;
  const longitude = place.longitude;
  const providerPlaceId = placeIdOf(place);
  if (!name || latitude == null || longitude == null || !providerPlaceId) return null;

  const distanceMeters = Math.round(distanceBetween(userLat, userLon, latitude, longitude));
  if (distanceMeters > MAX_DISTANCE_M) return null;

  return {
    provider: 'serper',
    providerPlaceId,
    name,
    address: place.address,
    category: categoryFromSerper(place),
    latitude,
    longitude,
    distanceMeters,
    imageUrl: place.thumbnailUrl?.trim() || undefined,
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

async function serperPost(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw Object.assign(new Error('Venue search is busy right now. Try again in a moment.'), { status: 429 });
  }
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Serper authentication failed. Check SERPER_API_KEY.'), { status: 401 });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(new Error(detail.slice(0, 180) || 'Could not load nearby venues.'), { status: 502 });
  }

  return response.json();
}

function mapsBody(q: string, latitude: number, longitude: number, hl: string, gl: string, num = 15) {
  return {
    q,
    ll: `@${latitude},${longitude},17z`,
    hl,
    gl,
    num,
  };
}

export async function searchSerperVenues(
  latitude: number,
  longitude: number,
  query?: string,
  lang = 'en-US'
): Promise<VenueCandidate[]> {
  const { hl, gl } = langParts(lang);
  const q = query?.trim();

  let places: SerperPlace[] = [];
  if (q) {
    const payload = (await serperPost(MAPS_URL, mapsBody(q, latitude, longitude, hl, gl, 20))) as MapsResponse;
    places = payload.places ?? [];
  } else {
    const batch = NEARBY_QUERIES.map((term) => mapsBody(term, latitude, longitude, hl, gl, 12));
    const payload = (await serperPost(MAPS_URL, batch)) as MapsResponse | MapsResponse[];
    const rows = Array.isArray(payload) ? payload : [payload];
    places = rows.flatMap((row) => row.places ?? []);
  }

  const venues = places
    .map((place) => normalizePlace(place, latitude, longitude))
    .filter((item): item is VenueCandidate => item != null);

  return clusterAndRank(venues);
}

export async function searchSerperVenueImage(query: string, lang = 'en-US'): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const { hl, gl } = langParts(lang);
  const payload = (await serperPost(IMAGES_URL, { q, hl, gl, num: 5 })) as {
    images?: ImageResult[];
  };
  const first = (payload.images ?? []).find((item) => item.imageUrl || item.thumbnailUrl);
  return first?.imageUrl?.trim() || first?.thumbnailUrl?.trim() || null;
}
