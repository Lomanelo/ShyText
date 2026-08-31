export function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Apple searchRegion: north-lat,east-lng,south-lat,west-lng */
export function searchRegionBox(latitude: number, longitude: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)));
  const north = latitude + latDelta;
  const south = latitude - latDelta;
  const east = longitude + lngDelta;
  const west = longitude - lngDelta;
  return `${north},${east},${south},${west}`;
}
