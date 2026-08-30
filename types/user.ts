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
  bio?: string;
  createdAt: number;
  status: UserStatus;
  stats: UserStats;
  expoPushToken?: string;
}
