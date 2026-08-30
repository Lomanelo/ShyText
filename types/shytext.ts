export const SHYTEXT_CATEGORIES = [
  'chat',
  'play',
  'social',
  'study',
  'watch',
  'network',
  'game',
  'other',
] as const;

export type ShyTextCategory = (typeof SHYTEXT_CATEGORIES)[number];

export type ShyTextStatus = 'active' | 'expired' | 'deleted' | 'moderated';

export interface ShyTextPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  venueId: string;
  message: string;
  category: ShyTextCategory;
  createdAt: number;
  expiresAt: number;
  status: ShyTextStatus;
  responseCount: number;
}
