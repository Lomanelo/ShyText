import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { addUserInteractionListener, type LiveActivity } from 'expo-widgets';
import i18n from '../i18n';
import { SHYNE_IDLE_WINDOW_MS } from '../utils/config';
import { ensureShyneLiveLogoUri } from './shyneLiveLogo';
import ShyneLiveActivity from '../widgets/ShyneLiveActivity';
import {
  SHYNE_LIVE_ACTIVITY_NAME,
  type ShyneLiveActivityProps,
} from '../widgets/shyneLiveActivityTypes';

export type ShyneLiveActivitySnapshot = {
  venueId: string;
  venueName: string;
  startedAt: number;
  expiresAt: number;
};

export type ShyneLiveAction = 'extend' | 'shyOut' | 'open';

const isIos = Platform.OS === 'ios';

let lastKey: string | null = null;

function actionUrl(venueId: string, action: ShyneLiveAction): string {
  if (action === 'open') {
    return Linking.createURL(`/venue/${venueId}`, {
      queryParams: { liveAction: 'open' },
    });
  }
  // Extend / Shy Out should not force a venue screen flash — handle at root.
  return Linking.createURL('/', {
    queryParams: { liveAction: action, venueId },
  });
}

function buildProps(
  snap: ShyneLiveActivitySnapshot,
  logoUri: string,
  status: 'active' | 'ended' = 'active'
): ShyneLiveActivityProps {
  // Progress + countdown must span the *current* idle window, not lifetime since first Shyne.
  const windowStart = Math.max(snap.startedAt, snap.expiresAt - SHYNE_IDLE_WINDOW_MS);
  return {
    venueId: snap.venueId,
    venueName: snap.venueName,
    startedAt: windowStart,
    expiresAt: snap.expiresAt,
    status,
    title: i18n.t('venue.shyningHere'),
    remainingLabel: i18n.t('liveActivity.left'),
    extendLabel: i18n.t('common.extend'),
    shyOutLabel: i18n.t('common.shyOut'),
    endedLabel: i18n.t('liveActivity.ended'),
    extendUrl: actionUrl(snap.venueId, 'extend'),
    shyOutUrl: actionUrl(snap.venueId, 'shyOut'),
    openUrl: actionUrl(snap.venueId, 'open'),
    logoUri,
  };
}

function snapshotKey(snap: ShyneLiveActivitySnapshot | null, logoUri = ''): string {
  if (!snap) return '';
  return `${snap.venueId}:${snap.expiresAt}:${snap.startedAt}:${logoUri ? 'logo' : 'nologo'}`;
}

function activeInstances(): LiveActivity<ShyneLiveActivityProps>[] {
  if (!isIos || !ShyneLiveActivity) return [];
  try {
    return ShyneLiveActivity.getInstances();
  } catch (error) {
    if (__DEV__) console.warn('[ShyneLiveActivity] getInstances failed', error);
    return [];
  }
}

/**
 * Start or refresh the Shyne Live Activity to match the current check-in.
 * Pass null to end every active Shyne activity.
 */
export async function syncShyneLiveActivity(
  snap: ShyneLiveActivitySnapshot | null
): Promise<void> {
  if (!isIos) return;
  if (!ShyneLiveActivity) {
    if (__DEV__) {
      console.warn(
        '[ShyneLiveActivity] factory missing — rebuild the iOS native app with expo-widgets'
      );
    }
    return;
  }

  const logoUri = (await ensureShyneLiveLogoUri()) ?? '';
  const key = snapshotKey(snap, logoUri);
  if (key && key === lastKey && activeInstances().length > 0) return;

  try {
    if (!snap || snap.expiresAt <= Date.now()) {
      lastKey = null;
      await endAllShyneLiveActivities('immediate');
      return;
    }

    const props = buildProps(snap, logoUri);
    const staleDate = new Date(snap.expiresAt);
    const url = actionUrl(snap.venueId, 'open');
    const existing = activeInstances();

    if (existing.length > 0) {
      await Promise.all(existing.map((instance) => instance.update(props, staleDate)));
      // End extras if somehow more than one is running.
      if (existing.length > 1) {
        await Promise.all(existing.slice(1).map((instance) => instance.end('immediate')));
      }
    } else {
      ShyneLiveActivity.start(props, url, staleDate);
      if (__DEV__) {
        console.log('[ShyneLiveActivity] started', snap.venueName, 'until', staleDate.toISOString());
      }
    }
    lastKey = key;
  } catch (error) {
    // Live Activities can fail (permissions, budget, simulator) — never block Shyne.
    if (__DEV__) console.warn('[ShyneLiveActivity] sync failed', error);
  }
}

export async function endAllShyneLiveActivities(
  policy: 'default' | 'immediate' = 'immediate',
  final?: ShyneLiveActivitySnapshot
): Promise<void> {
  if (!isIos || !ShyneLiveActivity) return;
  lastKey = null;
  try {
    const instances = activeInstances();
    const logoUri = (await ensureShyneLiveLogoUri()) ?? '';
    const finalProps = final ? buildProps(final, logoUri, 'ended') : undefined;
    await Promise.all(instances.map((instance) => instance.end(policy, finalProps, new Date())));
  } catch {
    // ignore
  }
}

/** Optimistic timer bump used by the widget Extend control when the app is alive. */
export function nextExtendExpiresAt(from = Date.now()): number {
  return from + SHYNE_IDLE_WINDOW_MS;
}

/**
 * Parse a deep link opened from the Live Activity (banner tap or Link).
 */
export function parseShyneLiveAction(
  url: string | null | undefined
): { venueId: string; action: ShyneLiveAction } | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const qVenue = parsed.queryParams?.venueId;
    const venueFromQuery = Array.isArray(qVenue) ? qVenue[0] : qVenue;
    const path = (parsed.path ?? '').replace(/^\//, '');
    const match = path.match(/^venue\/([^/?]+)/);
    const venueId =
      (typeof venueFromQuery === 'string' && venueFromQuery) || match?.[1] || undefined;
    if (!venueId) return null;
    const raw = parsed.queryParams?.liveAction;
    const action = (Array.isArray(raw) ? raw[0] : raw) as string | undefined;
    if (action === 'extend' || action === 'shyOut' || action === 'open') {
      return { venueId, action };
    }
    // Banner tap on /venue/:id with no action → open.
    if (match?.[1]) return { venueId, action: 'open' };
    return null;
  } catch {
    return null;
  }
}

/**
 * Listen for Live Activity button taps while the app process is alive.
 * Link-based actions are handled via deep links instead.
 */
export function listenShyneLiveActivityInteractions(
  handler: (event: { target: string }) => void
): { remove: () => void } {
  if (!isIos) return { remove: () => undefined };
  try {
    return addUserInteractionListener((event) => {
      if (event.source !== SHYNE_LIVE_ACTIVITY_NAME) return;
      handler({ target: event.target });
    });
  } catch {
    return { remove: () => undefined };
  }
}
