export interface VenueCandidate {
  provider: 'apple' | 'google' | 'demo';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface Venue {
  id: string;
  provider: 'apple' | 'demo' | 'google';
  providerPlaceId: string;
  name: string;
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  activeCount?: number;
}

export interface CheckIn {
  id: string;
  userId: string;
  venueId: string;
  createdAt: number;
  expiresAt: number;
  displayName?: string;
  avatarUrl?: string;
  age?: number;
  vibe?: string;
  status?: string;
}

export interface PlacesProvider {
  getNearbyVenues(latitude: number, longitude: number): Promise<VenueCandidate[]>;
  searchVenues?(query: string, latitude: number, longitude: number): Promise<VenueCandidate[]>;
}

export class PlacesRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'places_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
