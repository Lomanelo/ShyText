import type { Config, Context } from '@netlify/functions';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const key = Netlify.env.get('GOOGLE_MAPS_API_KEY');
  if (!key) {
    return Response.json({ error: 'Places is not configured' }, { status: 501 });
  }

  const endpoint = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  endpoint.searchParams.set('location', `${lat},${lng}`);
  endpoint.searchParams.set('radius', '400');
  endpoint.searchParams.set('type', 'cafe|bar|restaurant|library|park|university');
  endpoint.searchParams.set('key', key);

  const response = await fetch(endpoint);
  if (!response.ok) {
    return Response.json({ error: 'Places request failed' }, { status: 502 });
  }
  const payload = await response.json();
  const venues = (payload.results ?? []).slice(0, 15).map((place: {
    place_id: string;
    name: string;
    vicinity?: string;
    types?: string[];
    geometry?: { location?: { lat: number; lng: number } };
  }) => ({
    id: `google-${place.place_id}`,
    provider: 'google',
    providerPlaceId: place.place_id,
    name: place.name,
    address: place.vicinity,
    category: place.types?.[0],
    latitude: place.geometry?.location?.lat,
    longitude: place.geometry?.location?.lng,
  }));

  return Response.json(venues);
};

export const config: Config = {
  path: '/api/places',
};
