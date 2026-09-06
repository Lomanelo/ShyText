export function isDevToolsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DEV_MODE === 'true';
}

export const CHECK_IN_MS = 60 * 60 * 1000;
export const DEFAULT_SHYTEXT_MINUTES = 30;
/** Production Places proxy (Serper). Override with EXPO_PUBLIC_PLACES_PROXY_URL. */
export const DEFAULT_PLACES_PROXY_URL = 'https://shytextapi.netlify.app/api/places';
export const MAX_ACTIVE_SHYTEXTS = 1;
export const MAX_SHYTEXTS_PER_HOUR = 10;
export const MAX_REQUESTS_PER_HOUR = 20;
/** Pending inbound ShyText exclusivity window before the other person can send theirs. */
export const REQUEST_REPLY_LOCK_MS = 60 * 60 * 1000;
export const MAX_MESSAGE_LENGTH = 160;
export const MAX_SHYTEXT_MESSAGE_LENGTH = 120;
export const MAX_STATUS_LENGTH = 40;
export const MAX_BIO_LENGTH = 80;
/** @deprecated Chat threads no longer expire. Kept only for old docs that still store sendUntil. */
export const CHAT_SEND_MS = 60 * 60 * 1000;
