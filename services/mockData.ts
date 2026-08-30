import { Venue } from '../types/venue';
import { ShyTextPost } from '../types/shytext';

export const DEMO_VENUES: Venue[] = [
  {
    id: 'demo-paddys-corner',
    provider: 'demo',
    providerPlaceId: 'demo-paddys-corner',
    name: "Paddy's Corner",
    address: '5 Rue Example',
    category: 'Bar',
    latitude: 48.853, 
    longitude: 2.35,
    activeCount: 3,
  },
  {
    id: 'demo-campus-library',
    provider: 'demo',
    providerPlaceId: 'demo-campus-library',
    name: 'Campus Library',
    address: 'University Quad',
    category: 'Study',
    latitude: 48.854,
    longitude: 2.351,
    activeCount: 1,
  },
  {
    id: 'demo-central-park',
    provider: 'demo',
    providerPlaceId: 'demo-central-park',
    name: 'Riverside Park',
    address: 'River Walk',
    category: 'Park',
    latitude: 48.852,
    longitude: 2.349,
    activeCount: 0,
  },
];

export function seedShyTexts(venueId: string): ShyTextPost[] {
  const now = Date.now();
  return [
    {
      id: 'seed-1',
      authorId: 'seed-loma',
      authorName: 'Loma',
      venueId,
      message: 'Anyone want to play dominoes?',
      category: 'play',
      createdAt: now - 4 * 60000,
      expiresAt: now + 21 * 60000,
      status: 'active',
      responseCount: 0,
    },
    {
      id: 'seed-2',
      authorId: 'seed-alex',
      authorName: 'Alex',
      venueId,
      message: 'Here alone before my train. Anyone fancy a drink?',
      category: 'social',
      createdAt: now - 9 * 60000,
      expiresAt: now + 12 * 60000,
      status: 'active',
      responseCount: 0,
    },
    {
      id: 'seed-3',
      authorId: 'seed-mira',
      authorName: 'Mira',
      venueId,
      message: 'Anyone studying here?',
      category: 'study',
      createdAt: now - 2 * 60000,
      expiresAt: now + 28 * 60000,
      status: 'active',
      responseCount: 0,
    },
  ];
}
