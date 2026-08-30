import { Venue, PlacesProvider } from '../types/venue';
import { distanceBetween } from '../utils/geo';
import { isDevToolsEnabled } from '../utils/config';
import { DEMO_VENUES } from './mockData';

export const PADDYS_CORNER_ID = 'demo-paddys-corner';

class DemoPlacesProvider implements PlacesProvider {
  async getNearbyVenues(latitude: number, longitude: number): Promise<Venue[]> {
    return DEMO_VENUES.map((venue) => ({
      ...venue,
      activeCount: venue.activeCount,
      latitude: venue.latitude,
      longitude: venue.longitude,
    })).sort((a, b) => {
      const da = distanceBetween(latitude, longitude, a.latitude ?? latitude, a.longitude ?? longitude);
      const db = distanceBetween(latitude, longitude, b.latitude ?? latitude, b.longitude ?? longitude);
      return da - db;
    });
  }
}

class GooglePlacesProvider implements PlacesProvider {
  async getNearbyVenues(latitude: number, longitude: number): Promise<Venue[]> {
    const endpoint = process.env.EXPO_PUBLIC_PLACES_PROXY_URL;
    if (!endpoint) {
      return new DemoPlacesProvider().getNearbyVenues(latitude, longitude);
    }
    const response = await fetch(
      `${endpoint}?lat=${latitude}&lng=${longitude}`
    );
    if (!response.ok) {
      throw new Error('Could not load nearby venues.');
    }
    return response.json();
  }
}

export function getPlacesProvider(): PlacesProvider {
  if (isDevToolsEnabled() || !process.env.EXPO_PUBLIC_PLACES_PROXY_URL) {
    return new DemoPlacesProvider();
  }
  return new GooglePlacesProvider();
}
