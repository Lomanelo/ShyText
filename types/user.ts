import { VisibilityMode } from './shytext';

export type UserStatus = 'active' | 'suspended';

export type NotificationPrefs = {
  shytexts: boolean;
  accepted: boolean;
  chats: boolean;
  checkInEnding: boolean;
  /** Someone else Shynes while you’re already lit at the same venue. */
  coShyne: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  shytexts: true,
  accepted: true,
  chats: true,
  checkInEnding: true,
  coShyne: true,
};

export interface UserStats {
  shytextsPosted: number;
  chatsStarted: number;
}

export type Gender = 'man' | 'woman' | 'nonbinary' | 'another' | 'prefer_not';

export const GENDER_OPTIONS: Gender[] = [
  'man',
  'woman',
  'nonbinary',
  'another',
  'prefer_not',
];

/**
 * Owner-only document at users/{uid}/private/profile.
 * Never rendered to other users — only the handle and photo are public.
 */
export interface PrivateProfile {
  gender?: Gender;
  /** ISO date (YYYY-MM-DD). Kept private; age is not shown publicly by default. */
  birthDate?: string;
  email?: string;
  city?: string;
  /** Country of residence (localized display name) — inferred, editable in settings. */
  country?: string;
  /** ISO 3166-1 alpha-2 — source of truth for the country picker. */
  countryCode?: string;
  /** Optional; not collected during onboarding. */
  nationality?: string;
  nationalityCode?: string;
  updatedAt?: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  /** Public display age only. Do not store or send birthDate on this document. */
  age?: number;
  bio?: string;
  createdAt: number;
  status: UserStatus;
  stats: UserStats;
  expoPushToken?: string;
  /** BCP-47 tag used to localize push copy for this person. */
  language?: string;
  notificationPrefs?: NotificationPrefs;
  /**
   * Reserved for a future Shy Mode. Visibility is derived from an active
   * ShyText, not this field.
   */
  visibilityMode?: VisibilityMode;
}
