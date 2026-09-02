/** Sync in-memory cache so venue hero can reuse the list thumb across navigation. */

const byKey = new Map<string, string>();

export function rememberVenueImage(
  keys: Array<string | null | undefined>,
  url: string | null | undefined
): void {
  if (!url) return;
  for (const key of keys) {
    if (key) byKey.set(key, url);
  }
}

export function lookupVenueImage(...keys: Array<string | null | undefined>): string | null {
  for (const key of keys) {
    if (key) {
      const hit = byKey.get(key);
      if (hit) return hit;
    }
  }
  return null;
}
