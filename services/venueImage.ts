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

export function venueImageProxyBase(): string | null {
  const dedicated = process.env.EXPO_PUBLIC_VENUE_IMAGE_PROXY_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, '');

  const places = process.env.EXPO_PUBLIC_PLACES_PROXY_URL?.trim();
  if (places) {
    try {
      return `${new URL(places).origin}/api/venue-image`;
    } catch {
      return null;
    }
  }

  const apiBase = process.env.EXPO_PUBLIC_API_BASE?.trim() || 'https://shytext.com';
  return `${apiBase.replace(/\/$/, '')}/api/venue-image`;
}

export function isVenueImageConfigured() {
  return Boolean(venueImageProxyBase());
}

/** Prefer the Serper Maps thumbnail directly — no Netlify re-proxy hop. */
export function buildVenueImageUrl(target: VenueImageTarget, size: VenueImageSize = DEFAULT_SIZE): string | null {
  const direct = target.imageUrl?.trim();
  if (direct) return direct;

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

  if (!url.searchParams.has('lat') && !url.searchParams.has('name') && !url.searchParams.has('address')) {
    return null;
  }

  return url.toString();
}

export function buildVenueImageMetaUrl(target: VenueImageTarget): string | null {
  if (target.imageUrl?.trim()) {
    return null;
  }
  const imageUrl = buildVenueImageUrl(target);
  if (!imageUrl) return null;
  const url = new URL(imageUrl);
  url.searchParams.set('meta', '1');
  return url.toString();
}
