import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

/** Bump when the asset changes so devices re-copy into the App Group. */
const LOGO_FILE = 'shyne-live-flame-v6.png';

let cachedUri: string | undefined;
let seeding: Promise<string | undefined> | null = null;

/**
 * Copy the transparent flame-lit mark into the App Group widgets directory.
 * Used for both Lock Screen banner and Dynamic Island (with fullColor).
 */
export async function ensureShyneLiveLogoUri(): Promise<string | undefined> {
  if (Platform.OS !== 'ios') return undefined;
  if (cachedUri) return cachedUri;
  if (seeding) return seeding;

  seeding = (async () => {
    try {
      const dir = widgetsDirectory as string | null | undefined;
      if (!dir) {
        if (__DEV__) console.warn('[ShyneLiveActivity] widgetsDirectory missing');
        return undefined;
      }

      const dest = new File(dir, LOGO_FILE);
      if (dest.exists) {
        try {
          dest.delete();
        } catch {
          // ignore
        }
      }

      const asset = Asset.fromModule(require('../assets/images/live-activity-flame.png'));
      await asset.downloadAsync();
      if (!asset.localUri) return undefined;

      const src = new File(asset.localUri);
      // Write bytes instead of copy — more reliable across App Group boundaries.
      const bytes = await src.bytes();
      dest.create();
      dest.write(bytes);

      if (!dest.exists || dest.size < 100) {
        if (__DEV__) console.warn('[ShyneLiveActivity] logo write empty', dest.uri, dest.size);
        return undefined;
      }

      // ImageView loads via URL(string:) — must be a file:// absolute string.
      cachedUri = dest.uri.startsWith('file:') ? dest.uri : `file://${dest.uri}`;
      if (__DEV__) console.log('[ShyneLiveActivity] logo ready', cachedUri, dest.size);
      return cachedUri;
    } catch (error) {
      if (__DEV__) console.warn('[ShyneLiveActivity] logo seed failed', error);
      return undefined;
    } finally {
      seeding = null;
    }
  })();

  return seeding;
}
