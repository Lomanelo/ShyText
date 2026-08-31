import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export function isDevToolsEnabled(): boolean {
  const channel = extra.eas?.channel ?? extra.channel;
  if (channel === 'production') return false;
  if (process.env.EXPO_PUBLIC_DEV_MODE === 'true') return true;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export const CHECK_IN_MS = 60 * 60 * 1000;
export const DEFAULT_SHYTEXT_MINUTES = 30;
export const MAX_ACTIVE_SHYTEXTS = 1;
export const MAX_SHYTEXTS_PER_HOUR = 10;
export const MAX_REQUESTS_PER_HOUR = 20;
export const MAX_MESSAGE_LENGTH = 160;
export const MAX_SHYTEXT_MESSAGE_LENGTH = 120;
