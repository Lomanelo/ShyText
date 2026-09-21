import { DEFAULT_PLACES_PROXY_URL } from '../utils/config';
import { idTokenQueryValue } from './api';

export type VenueImageTarget = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  name?: string | null;
  imageUrl?: string | null;
};

export type VenueImageSize = {
  width: number;
  height: number;
};

const DEFAULT_SIZE: VenueImageSize = { width: 640, height: 360 };

function clampDimension(value: number) {
  return Math.min(640, Math.max(1, Math.round(value)));
}

function placesOrigin() {
  const places = process.env.EXPO_PUBLIC_PLACES_PROXY_URL?.trim() || DEFAULT_PLACES_PROXY_URL;
  try {
    return new URL(places).origin;
  } catch {
    return 'https://shytextapi.netlify.app';
  }
}

export function venueImageProxyBase(): string | null {
  const dedicated = process.env.EXPO_PUBLIC_VENUE_IMAGE_PROXY_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, '');
  return `${placesOrigin()}/api/venue-image`;
}

export function isVenueImageConfigured() {
  return Boolean(venueImageProxyBase());
}

export function isProxyUrl(url: string) {
  try {
    const base = venueImageProxyBase();
    if (!base) return false;
    return url.startsWith(base) || url.includes('/api/venue-image');
  } catch {
    return false;
  }
}

/** Prefer a durable Serper thumb; strip expired idToken from cached proxy URLs. */
export function canonicalVenueImageUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (!isProxyUrl(raw)) return raw;
  try {
    const next = new URL(raw);
    next.searchParams.delete('idToken');
    return next.toString();
  } catch {
    return raw;
  }
}

/**
 * Prefer Serper Maps thumbnail directly — no Netlify hop.
 * Proxy URLs need a Firebase ID token query param (Image cannot send Authorization).
 */
export function buildVenueImageUrl(target: VenueImageTarget, size: VenueImageSize = DEFAULT_SIZE): string | null {
  const direct = canonicalVenueImageUrl(target.imageUrl);
  if (direct && !isProxyUrl(direct)) return direct;

  const base = venueImageProxyBase();
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set('w', String(clampDimension(size.width)));
  url.searchParams.set('h', String(clampDimension(size.height)));

  const lat = target.latitude;
  const lng = target.longitude;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lng', String(lng));
  }
  if (target.name?.trim()) url.searchParams.set('name', target.name.trim());
  if (target.address?.trim()) url.searchParams.set('address', target.address.trim());

  // Reuse a prior proxy URL's search when target has no coords/name (rare).
  if (direct && isProxyUrl(direct)) {
    try {
      const prior = new URL(direct);
      for (const key of ['lat', 'lng', 'name', 'address', 'thumb'] as const) {
        const value = prior.searchParams.get(key);
        if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
    } catch {
      // ignore
    }
  }

  if (!url.searchParams.has('lat') && !url.searchParams.has('name') && !url.searchParams.has('address')) {
    return null;
  }

  return url.toString();
}

/** Attach a fresh ID token when the URL hits our authenticated image proxy. */
export async function authorizeVenueImageUrl(url: string | null | undefined): Promise<string | null> {
  const canonical = canonicalVenueImageUrl(url);
  if (!canonical) return null;
  if (!isProxyUrl(canonical)) return canonical;
  const token = await idTokenQueryValue();
  if (!token) return null;
  const next = new URL(canonical);
  next.searchParams.set('idToken', token);
  return next.toString();
}

/** Build + authorize in one step for display. */
export async function resolveVenueImageUrl(
  target: VenueImageTarget,
  size: VenueImageSize = DEFAULT_SIZE
): Promise<string | null> {
  return authorizeVenueImageUrl(buildVenueImageUrl(target, size));
}

export function buildVenueImageMetaUrl(target: VenueImageTarget): string | null {
  const direct = canonicalVenueImageUrl(target.imageUrl);
  if (direct && !isProxyUrl(direct)) {
    return null;
  }
  const imageUrl = buildVenueImageUrl(target);
  if (!imageUrl) return null;
  const url = new URL(imageUrl);
  url.searchParams.set('meta', '1');
  return url.toString();
}
