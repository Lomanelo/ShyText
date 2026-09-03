import { VisibilityMode } from './shytext';

export type UserStatus = 'active' | 'suspended';

export type NotificationPrefs = {
  shytexts: boolean;
  accepted: boolean;
  chats: boolean;
  checkInEnding: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  shytexts: true,
  accepted: true,
  chats: true,
  checkInEnding: true,
};

export interface UserStats {
  shytextsPosted: number;
  chatsStarted: number;
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
