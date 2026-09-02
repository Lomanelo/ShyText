export type StreetViewMeta = {
  status: string;
  copyright?: string;
  date?: string;
  location?: { lat: number; lng: number };
  pano_id?: string;
};

export type StreetViewRenderOptions = {
  location: string;
  key: string;
  width: number;
  height: number;
  heading?: number;
  fov?: number;
  pitch?: number;
  radius?: number;
};

const METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';
const STATIC_URL = 'https://maps.googleapis.com/maps/api/streetview';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseStreetViewOptions(url: URL) {
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error('lat and lng are required.'), { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw Object.assign(new Error('Invalid coordinates.'), { status: 400 });
  }

  const width = clamp(Number(url.searchParams.get('w') || 640), 1, 640);
  const height = clamp(Number(url.searchParams.get('h') || 360), 1, 640);
  const heading = url.searchParams.has('heading') ? Number(url.searchParams.get('heading')) : undefined;
  const fov = url.searchParams.has('fov') ? clamp(Number(url.searchParams.get('fov')), 10, 120) : undefined;
  const pitch = url.searchParams.has('pitch') ? clamp(Number(url.searchParams.get('pitch')), -90, 90) : undefined;
  const radius = url.searchParams.has('radius') ? clamp(Number(url.searchParams.get('radius')), 1, 500) : 50;

  // Prefer exact venue coordinates. Address/name geocoding collapses nearby pubs
  // onto the same street camera and is a poor signal for POI facades.
  const location = `${lat},${lng}`;

  return { lat, lng, location, width, height, heading, fov, pitch, radius };
}

export function streetViewMetadataUrl(location: string, key: string, radius = 50) {
  const params = new URLSearchParams({
    location,
    key,
    radius: String(radius),
    source: 'outdoor',
  });
  return `${METADATA_URL}?${params.toString()}`;
}

export function streetViewStaticUrl(options: StreetViewRenderOptions) {
  const params = new URLSearchParams({
    location: options.location,
    size: `${options.width}x${options.height}`,
    key: options.key,
    return_error_code: 'true',
    source: 'outdoor',
  });
  if (options.radius != null) params.set('radius', String(options.radius));
  if (options.heading != null && Number.isFinite(options.heading)) {
    params.set('heading', String(options.heading));
  }
  if (options.fov != null && Number.isFinite(options.fov)) {
    params.set('fov', String(options.fov));
  }
  if (options.pitch != null && Number.isFinite(options.pitch)) {
    params.set('pitch', String(options.pitch));
  }
  return `${STATIC_URL}?${params.toString()}`;
}

export async function fetchStreetViewMetadata(location: string, key: string, radius = 50): Promise<StreetViewMeta> {
  const response = await fetch(streetViewMetadataUrl(location, key, radius));
  if (!response.ok) {
    throw Object.assign(new Error('Street View metadata request failed.'), { status: 502 });
  }
  return (await response.json()) as StreetViewMeta;
}

export function googleStreetViewConfigured() {
  return Boolean(Netlify.env.get('GOOGLE_MAPS_API_KEY')?.trim());
}
