export type PlaceKind =
  | 'bar'
  | 'cafe'
  | 'restaurant'
  | 'nightlife'
  | 'park'
  | 'study'
  | 'hotel'
  | 'gym'
  | 'museum'
  | 'theater'
  | 'music'
  | 'campus'
  | 'bakery'
  | 'brewery'
  | 'place';

const KIND: Record<string, PlaceKind> = {
  bar: 'bar',
  nightlife: 'bar',
  nightclub: 'nightlife',
  winery: 'bar',
  distillery: 'bar',
  cafe: 'cafe',
  bakery: 'bakery',
  restaurant: 'restaurant',
  park: 'park',
  fairground: 'park',
  amusementpark: 'park',
  library: 'study',
  study: 'study',
  university: 'campus',
  hotel: 'hotel',
  fitnesscenter: 'gym',
  stadium: 'gym',
  bowling: 'gym',
  museum: 'museum',
  theater: 'theater',
  movietheater: 'theater',
  musicvenue: 'music',
  brewery: 'brewery',
};

export function placeKind(category?: string): PlaceKind {
  if (!category) return 'place';
  return KIND[category.toLowerCase().replace(/[\s_-]/g, '')] ?? 'place';
}

export function placeKindLabel(kind: PlaceKind): string {
  if (kind === 'cafe') return 'café';
  if (kind === 'nightlife') return 'night';
  if (kind === 'place') return 'place';
  return kind;
}
