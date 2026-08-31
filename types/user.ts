import { VisibilityMode } from './shytext';

export type UserStatus = 'active' | 'suspended';

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
  /**
   * Reserved for a future Shy Mode. Visibility is derived from an active
   * ShyText, not this field.
   */
  visibilityMode?: VisibilityMode;
}
