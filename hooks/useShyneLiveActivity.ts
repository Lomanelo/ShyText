import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  listenShyneLiveActivityInteractions,
  parseShyneLiveAction,
  type ShyneLiveAction,
} from '../services/shyneLiveActivity';
import { extendMyCheckIn } from '../services/venues';

type Handlers = {
  onExtend: () => Promise<void> | void;
  onShyOut: () => Promise<void> | void;
};

/**
 * Handles Live Activity Link deep links + in-process button taps.
 */
export function useShyneLiveActivityActions(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const lastActionKey = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const run = async (venueId: string, action: ShyneLiveAction, key: string) => {
      if (lastActionKey.current === key) return;
      lastActionKey.current = key;
      setTimeout(() => {
        if (lastActionKey.current === key) lastActionKey.current = null;
      }, 2500);

      if (action === 'extend') {
        await handlersRef.current.onExtend();
        return;
      }
      if (action === 'shyOut') {
        await handlersRef.current.onShyOut();
        return;
      }
      router.push(`/venue/${venueId}`);
    };

    const handleUrl = (url: string | null | undefined) => {
      const parsed = parseShyneLiveAction(url);
      if (!parsed) return;
      void run(parsed.venueId, parsed.action, `${parsed.action}:${parsed.venueId}:${url}`);
    };

    void Linking.getInitialURL().then(handleUrl);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    const interactionSub = listenShyneLiveActivityInteractions(({ target }) => {
      if (target === 'shyOut') void handlersRef.current.onShyOut();
      else if (target === 'extend') void handlersRef.current.onExtend();
    });

    return () => {
      linkSub.remove();
      interactionSub.remove();
    };
  }, []);
}

/** Force-extend helper used by Live Activity Extend. */
export async function extendShyneFromLiveActivity(): Promise<number | null> {
  return extendMyCheckIn({ force: true });
}
