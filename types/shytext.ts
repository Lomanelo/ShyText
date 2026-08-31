export const SHYTEXT_VIBES = [
  'chat',
  'drink',
  'coffee',
  'play',
  'study',
  'network',
  'flirt',
  'other',
] as const;

export type ShyTextVibe = (typeof SHYTEXT_VIBES)[number];

/** @deprecated Use ShyTextVibe. */
export type ShyTextIntent = ShyTextVibe;
/** @deprecated Use ShyTextVibe. */
export type ShyTextCategory = ShyTextVibe | 'meet' | 'social' | 'watch' | 'game';

export type ShyTextStatus = 'active' | 'expired' | 'stopped' | 'deleted' | 'moderated';

export type VisibilityMode = 'invisible' | 'open' | 'shy';

export const VIBE_LABELS: Record<ShyTextVibe, string> = {
  chat: '💬 Chat',
  drink: '🍺 Drink',
  coffee: '☕ Coffee',
  play: '🎱 Play',
  study: '📚 Study',
  network: '🤝 Network',
  flirt: '❤️ Flirt',
  other: '✨ Other',
};

/** @deprecated Use VIBE_LABELS. */
export const INTENT_LABELS = VIBE_LABELS;

export const SHYTEXT_INTENTS = SHYTEXT_VIBES;

const LEGACY_VIBE: Record<string, ShyTextVibe> = {
  chat: 'chat',
  drink: 'drink',
  coffee: 'coffee',
  play: 'play',
  study: 'study',
  network: 'network',
  flirt: 'flirt',
  other: 'other',
  meet: 'chat',
  social: 'drink',
  watch: 'other',
  game: 'play',
};

export function normalizeVibe(value: unknown): ShyTextVibe {
  if (typeof value === 'string' && value in LEGACY_VIBE) {
    return LEGACY_VIBE[value];
  }
  return 'chat';
}

/** @deprecated Use normalizeVibe. */
export const normalizeIntent = normalizeVibe;

export const ICEBREAKERS: Record<ShyTextVibe, string[]> = {
  chat: ['Hey 💬', 'Come say hi?', 'What are you up to?'],
  drink: ["I'm in 🍺", 'What are you drinking?', 'Mind if I join?'],
  coffee: ["I'm down ☕", 'Come say hi?', 'How long are you here?'],
  play: ["I'm in 🎱", 'Got room for one more?', 'How many are playing?'],
  study: ['Need a study buddy?', 'What are you working on?', 'Mind if I sit nearby?'],
  network: ['Mind if I say hi?', 'What brought you here?', 'Happy to connect'],
  flirt: ['You seem fun ❤️', 'Come say hi?', 'Can I buy you a drink?'],
  other: ['Hey', 'Come say hi?', 'How long are you here?'],
};

export interface ShyTextPost {
  id: string;
  userId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorAge?: number;
  authorBio?: string;
  venueId: string;
  vibe: ShyTextVibe;
  intent: ShyTextVibe;
  category: ShyTextVibe;
  message?: string;
  createdAt: number;
  expiresAt: number;
  status: ShyTextStatus;
  visibilityMode: VisibilityMode;
  responseCount: number;
}
