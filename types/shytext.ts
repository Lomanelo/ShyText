export const SHYTEXT_INTENTS = [
  'chat',
  'meet',
  'coffee',
  'drink',
  'play',
  'network',
  'flirt',
  'other',
] as const;

export type ShyTextIntent = (typeof SHYTEXT_INTENTS)[number];

/** @deprecated Use ShyTextIntent. Kept so older documents still type-check. */
export type ShyTextCategory = ShyTextIntent | 'social' | 'study' | 'watch' | 'game';

export type ShyTextStatus = 'active' | 'expired' | 'stopped' | 'deleted' | 'moderated';

/** Future matching modes. MVP only writes and reads "open". */
export type VisibilityMode = 'invisible' | 'open' | 'shy';

export const INTENT_LABELS: Record<ShyTextIntent, string> = {
  chat: '💬 Chat',
  meet: '👋 Meet',
  coffee: '☕ Coffee',
  drink: '🍺 Drink',
  play: '🎱 Play',
  network: '🤝 Network',
  flirt: '❤️ Flirt',
  other: '✨ Other',
};

const LEGACY_INTENT: Record<string, ShyTextIntent> = {
  chat: 'chat',
  meet: 'meet',
  coffee: 'coffee',
  drink: 'drink',
  play: 'play',
  network: 'network',
  flirt: 'flirt',
  other: 'other',
  social: 'drink',
  study: 'other',
  watch: 'other',
  game: 'play',
};

export function normalizeIntent(value: unknown): ShyTextIntent {
  if (typeof value === 'string' && value in LEGACY_INTENT) {
    return LEGACY_INTENT[value];
  }
  return 'other';
}

export interface ShyTextPost {
  id: string;
  userId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorAge?: number;
  venueId: string;
  intent: ShyTextIntent;
  /** Legacy field — same as intent after normalizeIntent. */
  category: ShyTextIntent;
  message?: string;
  createdAt: number;
  expiresAt: number;
  status: ShyTextStatus;
  visibilityMode: VisibilityMode;
  responseCount: number;
}
