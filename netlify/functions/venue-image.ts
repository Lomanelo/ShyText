import type { Config, Context } from '@netlify/functions';
import {
  fetchStreetViewMetadata,
  googleStreetViewConfigured,
  parseStreetViewOptions,
  streetViewStaticUrl,
} from './_shared/streetView';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!googleStreetViewConfigured()) {
    return json({ error: 'Street View is not configured.', code: 'not_configured', available: false }, 501);
  }

  const key = Netlify.env.get('GOOGLE_MAPS_API_KEY')!.trim();
  const url = new URL(req.url);
  const metaOnly = url.searchParams.get('meta') === '1';

  let options;
  try {
    options = parseStreetViewOptions(url);
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : 'Invalid request.';
    return json({ error: message, code: 'bad_request', available: false }, status);
  }

  let meta;
  try {
    meta = await fetchStreetViewMetadata(options.location, key, options.radius);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Street View metadata failed.';
    return json({ error: message, code: 'streetview_meta', available: false }, 502);
  }

  if (meta.status !== 'OK') {
    if (metaOnly) {
      return json({ status: meta.status, available: false });
    }
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  if (metaOnly) {
    return json({
      status: meta.status,
      available: true,
      location: meta.location,
      pano_id: meta.pano_id,
      date: meta.date,
      copyright: meta.copyright,
    });
  }

  const imageUrl = streetViewStaticUrl({
    location: options.location,
    key,
    width: options.width,
    height: options.height,
    heading: options.heading,
    fov: options.fov,
    pitch: options.pitch,
    radius: options.radius,
  });

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const bytes = await imageRes.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'no-store',
    },
  });
};

export const config: Config = {
  path: '/api/venue-image',
};
