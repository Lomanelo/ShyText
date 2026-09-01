import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { CheckIn } from '../types/venue';
import { CHECK_IN_RADIUS_METERS, distanceBetween } from '../utils/geo';
import { getVenue } from '../services/venues';
import { readForegroundPosition } from './useLocation';

export type LeftVenueNotice = {
  venueName: string;
};

export function useAwayCheckout({
  enabled,
  checkIn,
  expired,
  loading,
  leave,
}: {
  enabled: boolean;
  checkIn: CheckIn | null;
  expired: boolean;
  loading: boolean;
  leave: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<LeftVenueNotice | null>(null);
  const sessionStartedAt = useRef(Date.now());
  const evaluatedId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const pendingResume = useRef(false);
  const wasBackgrounded = useRef(false);
  const checkInRef = useRef(checkIn);
  const expiredRef = useRef(expired);
  const enabledRef = useRef(enabled);
  const leaveRef = useRef(leave);

  checkInRef.current = checkIn;
  expiredRef.current = expired;
  enabledRef.current = enabled;
  leaveRef.current = leave;

  const evaluate = useCallback(async (reason: 'appear' | 'resume') => {
    const live = checkInRef.current;
    if (!enabledRef.current || !live || expiredRef.current) return;
    if (evaluatedId.current === live.id) return;
    if (reason === 'appear' && live.createdAt > sessionStartedAt.current - 2_000) return;

    const place = await getVenue(live.venueId);
    if (!place || place.latitude == null || place.longitude == null) {
      evaluatedId.current = live.id;
      return;
    }
    if (checkInRef.current?.id !== live.id) return;

    const here = await readForegroundPosition();
    if (!here) return;
    if (checkInRef.current?.id !== live.id) return;

    const meters = distanceBetween(here.latitude, here.longitude, place.latitude, place.longitude);
    const accuracy = here.accuracy ?? 0;
    const stillThere = meters <= CHECK_IN_RADIUS_METERS + accuracy;
    evaluatedId.current = live.id;
    if (stillThere) return;
    if (!checkInRef.current || checkInRef.current.id !== live.id || expiredRef.current) return;

    const venueName = place.name;
    await leaveRef.current();
    setNotice({ venueName });
  }, []);

  const run = useCallback(
    async (reason: 'appear' | 'resume') => {
      if (inFlight.current) {
        if (reason === 'resume') pendingResume.current = true;
        return;
      }
      inFlight.current = true;
      try {
        await evaluate(reason);
      } finally {
        inFlight.current = false;
        if (pendingResume.current) {
          pendingResume.current = false;
          evaluatedId.current = null;
          void run('resume');
        }
      }
    },
    [evaluate]
  );

  useEffect(() => {
    if (!enabled || loading) return;
    void run('appear');
  }, [enabled, loading, checkIn?.id, expired, run]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        wasBackgrounded.current = true;
        return;
      }
      if (next !== 'active' || !wasBackgrounded.current) return;
      wasBackgrounded.current = false;
      evaluatedId.current = null;
      void run('resume');
    });
    return () => sub.remove();
  }, [run]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { notice, dismiss };
}
