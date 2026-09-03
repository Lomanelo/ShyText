/** Sync in-memory URLs so list thumbs and detail/avatars paint the same frame. */

import { Image } from 'expo-image';

const byKey = new Map<string, string>();

export function rememberImage(
  keys: Array<string | null | undefined>,
  url: string | null | undefined
): void {
  if (!url) return;
  for (const key of keys) {
    if (key) byKey.set(key, url);
  }
}

export function lookupImage(...keys: Array<string | null | undefined>): string | null {
  for (const key of keys) {
    if (key) {
      const hit = byKey.get(key);
      if (hit) return hit;
    }
  }
  return null;
}

/** Same path as venue thumbs: remember by id, then warm expo-image disk cache. */
export function prefetchProfileImage(
  keys: Array<string | null | undefined>,
  url: string | null | undefined
): void {
  if (!url) return;
  rememberImage(keys, url);
  void Image.prefetch(url, 'memory-disk');
}

