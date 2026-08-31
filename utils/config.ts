export function isDevToolsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DEV_MODE === 'true';
}

export const CHECK_IN_MS = 60 * 60 * 1000;
export const DEFAULT_SHYTEXT_MINUTES = 30;
export const MAX_ACTIVE_SHYTEXTS = 1;
export const MAX_SHYTEXTS_PER_HOUR = 10;
export const MAX_REQUESTS_PER_HOUR = 20;
export const MAX_MESSAGE_LENGTH = 160;
export const MAX_SHYTEXT_MESSAGE_LENGTH = 120;
export const MAX_STATUS_LENGTH = 40;
