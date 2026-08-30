export interface Venue {
  id: string;
  provider: 'google' | 'demo';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  activeCount?: number;
}

export interface CheckIn {
  id: string;
  userId: string;
  venueId: string;
  createdAt: number;
  expiresAt: number;
}

export interface PlacesProvider {
  getNearbyVenues(latitude: number, longitude: number): Promise<Venue[]>;
}
