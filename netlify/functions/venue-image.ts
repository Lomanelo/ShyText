import type { Config, Context } from '@netlify/functions';
import { searchSerperVenueImage, serperConfigured } from './_shared/serperClient';

type CacheEntry = { at: number; imageUrl: string };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clampDimension(value: number) {
  return Math.min(640, Math.max(1, Math.round(value)));
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!serperConfigured()) {
    return json({ error: 'Serper is not configured.', code: 'not_configured', available: false }, 501);
  }

  const url = new URL(req.url);
  const metaOnly = url.searchParams.get('meta') === '1';
  const thumb = (url.searchParams.get('thumb') || '').trim();
  const name = (url.searchParams.get('name') || '').trim();
  const address = (url.searchParams.get('address') || '').trim();
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const width = clampDimension(Number(url.searchParams.get('w') || 640));
  const height = clampDimension(Number(url.searchParams.get('h') || 360));
  const lang = (url.searchParams.get('lang') || 'en-US').trim() || 'en-US';

  let imageUrl = thumb;
  if (!imageUrl) {
    const queryParts = [name, address];
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      queryParts.push(`${lat.toFixed(5)},${lng.toFixed(5)}`);
    }
    const q = queryParts.filter(Boolean).join(' ').trim();
    if (!q) {
      return json({ error: 'name, address, thumb, or lat/lng required', code: 'bad_request', available: false }, 400);
    }

    const cacheKey = `${q.toLowerCase()}:${lang}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      imageUrl = hit.imageUrl;
    } else {
      try {
        const found = await searchSerperVenueImage(q, lang);
        if (!found) {
          if (metaOnly) return json({ available: false });
          return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
        }
        imageUrl = found;
        cache.set(cacheKey, { at: Date.now(), imageUrl: found });
      } catch (err) {
        const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 502;
        const message = err instanceof Error ? err.message : 'Image search failed.';
        return json({ error: message, code: 'serper_image', available: false }, status);
      }
    }
  }

  if (metaOnly) {
    return json({ available: true, imageUrl, width, height });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'ShyTextVenueImage/1.0' },
      redirect: 'follow',
    });
    if (!imageRes.ok) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const bytes = await imageRes.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
};

export const config: Config = {
  path: '/api/venue-image',
};
