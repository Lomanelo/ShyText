import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

/** Bundled venue category stills — shared with VenueStamp. */
export const STAMP_MODULES = [
  require('../assets/stamps/bar.jpg'),
  require('../assets/stamps/cafe.jpg'),
  require('../assets/stamps/restaurant.jpg'),
  require('../assets/stamps/nightlife.jpg'),
  require('../assets/stamps/park.jpg'),
  require('../assets/stamps/study.jpg'),
  require('../assets/stamps/hotel.jpg'),
  require('../assets/stamps/gym.jpg'),
  require('../assets/stamps/museum.jpg'),
  require('../assets/stamps/theater.jpg'),
  require('../assets/stamps/music.jpg'),
  require('../assets/stamps/campus.jpg'),
  require('../assets/stamps/bakery.jpg'),
  require('../assets/stamps/brewery.jpg'),
  require('../assets/stamps/place.jpg'),
] as const;

/** Brand flame marks used across splash, Shyne slider, nav wordmark, how-it-works. */
export const FLAME_MODULES = [
  require('../assets/images/flame-lit.png'),
  require('../assets/images/flame-dim.png'),
  require('../assets/images/flame-mark.png'),
  require('../assets/images/flame-white.png'),
] as const;

const LOCAL_MODULES = [...STAMP_MODULES, ...FLAME_MODULES] as const;

let warmPromise: Promise<void> | null = null;

/**
 * Decode stamps + flames into both native Asset + expo-image caches
 * before first paint (slider uses animated expo-image; stamps use expo-image).
 */
export function warmLocalAssets(): Promise<void> {
  if (!warmPromise) {
    warmPromise = Promise.all([
      Asset.loadAsync([...LOCAL_MODULES]).catch(() => undefined),
      ...LOCAL_MODULES.map((mod) => Image.loadAsync(mod).catch(() => undefined)),
    ]).then(() => undefined);
  }
  return warmPromise;
}

/** Prefetch remote venue thumbs into expo-image memory+disk cache. */
export function prefetchVenueImages(urls: Array<string | null | undefined>): void {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  if (unique.length === 0) return;
  void Image.prefetch(unique, 'memory-disk');
}
