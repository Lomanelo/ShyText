import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { CheckIn } from '../types/venue';
import { extendMyCheckIn } from '../services/venues';

const FOREGROUND_PULSE_MS = 5 * 60 * 1000;

/**
 * Activity-based Shyne: any app activity refreshes the 30-minute window, so
 * there is no fixed timeout while you keep using the app. Going quiet for
 * 30 minutes lets the check-in expire on its own (auto Shy Out). The separate
 * away-checkout hook still ends it immediately when you reopen far away.
 */
export function useShyneHeartbeat({
  enabled,
  checkIn,
  expired,
}: {
  enabled: boolean;
  checkIn: CheckIn | null;
  expired: boolean;
}) {
  const liveRef = useRef(false);
  liveRef.current = Boolean(
    enabled && checkIn && !expired && !checkIn.id.startsWith('pending:')
  );

  useEffect(() => {
    if (!liveRef.current) return;
    void extendMyCheckIn();
  }, [enabled, checkIn?.id, expired]);

  useEffect(() => {
    const pulse = () => {
      if (liveRef.current) void extendMyCheckIn();
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pulse();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') pulse();
    }, FOREGROUND_PULSE_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
}
