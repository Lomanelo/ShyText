import type { Config, Context } from '@netlify/functions';
import { searchSerperVenues, serperConfigured } from './_shared/serperClient';

type CacheEntry = { at: number; body: unknown };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 90_000;

function cacheKey(lat: number, lng: number, q: string, lang: string) {
  return `s:${lat.toFixed(3)}:${lng.toFixed(3)}:${q}:${lang}`;
}

function json(body: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extra },
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const q = (url.searchParams.get('q') || '').trim();
  const lang = (url.searchParams.get('lang') || 'en-US').trim() || 'en-US';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'lat and lng are required', code: 'bad_request' }, 400);
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Invalid coordinates.', code: 'bad_request' }, 400);
  }

  if (!serperConfigured()) {
    return json({ error: 'Serper is not configured.', code: 'not_configured' }, 501);
  }

  const key = cacheKey(lat, lng, q.toLowerCase(), lang);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json(hit.body);
  }

  try {
    const venues = await searchSerperVenues(lat, lng, q || undefined, lang);
    cache.set(key, { at: Date.now(), body: venues });
    return json(venues);
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 502;
    const message = err instanceof Error ? err.message : 'Could not load nearby venues.';
    const code = status === 429 ? 'rate_limited' : status === 401 ? 'serper_auth' : 'serper_request';
    return json({ error: message, code }, status);
  }
};

export const config: Config = {
  path: '/api/places',
};
