import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { CheckIn, Venue } from '../types/venue';
import {
  checkInToVenue,
  expireMyCheckIns,
  getVenue,
  listenOwnCheckIn,
  updateCheckInVibe,
} from '../services/venues';
import { auth } from '../services/firebase';
import { syncCheckInEndingNotice } from '../services/notifications';
import { rememberVenueImage } from '../services/venueImageCache';
import { buildVenueImageUrl } from '../services/venueImage';
import {
  clearPendingShyne,
  getPendingShyne,
  isPendingShyne,
  markPendingShyne,
  patchPendingCheckIn,
  setPendingShyneError,
} from '../services/pendingShyne';
import { ShyTextVibe } from '../types/shytext';
import { DEFAULT_SHYTEXT_MINUTES } from '../utils/config';

const KEY = 'currentVenue';
const VIBE_KEY = 'lastCheckInVibe';

function buildOptimisticCheckIn(
  venue: Venue,
  extras?: {
    ttlMinutes?: number;
    displayName?: string;
    avatarUrl?: string;
    age?: number;
    vibe?: ShyTextVibe;
  }
): CheckIn {
  const ttl = (extras?.ttlMinutes ?? DEFAULT_SHYTEXT_MINUTES) * 60_000;
  const now = Date.now();
  return {
    id: `pending:${venue.id}`,
    userId: auth.currentUser?.uid ?? 'pending',
    venueId: venue.id,
    createdAt: now,
    expiresAt: now + ttl,
    displayName: extras?.displayName,
    avatarUrl: extras?.avatarUrl,
    age: extras?.age,
    vibe: extras?.vibe ?? 'chat',
  };
}

export function useCurrentVenue() {
  /** Last opened venue (preview or shyne) — never used alone to mark list cards as Shyning. */
  const [venue, setVenue] = useState<Venue | null>(null);
  /** Venue tied to the active Shyne only. */
  const [shyneVenue, setShyneVenue] = useState<Venue | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCheckIn: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubCheckIn?.();
      unsubCheckIn = undefined;
      if (!user) {
        setCheckIn(null);
        setShyneVenue(null);
        setLoading(false);
        return;
      }
      unsubCheckIn = listenOwnCheckIn(user.uid, (next) => {
        setCheckIn((prev) => {
          if (prev?.id.startsWith('pending:')) {
            if (!next) return prev;
            if (next.venueId === prev.venueId) {
              clearPendingShyne(next.venueId);
              return next;
            }
            return prev;
          }
          return next;
        });
        setLoading(false);
        void syncCheckInEndingNotice(next?.expiresAt ?? null);
        if (!next) {
          setShyneVenue(null);
          return;
        }
        void getVenue(next.venueId).then((found) => {
          if (!found) return;
          setShyneVenue((prev) => ({
            ...found,
            imageUrl: found.imageUrl ?? (prev?.id === found.id ? prev.imageUrl : undefined),
          }));
        });
      });
    });
    void AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) setVenue(JSON.parse(raw));
    });
    return () => {
      unsubAuth();
      unsubCheckIn?.();
    };
  }, []);

  const rememberVenue = useCallback(async (next: Venue) => {
    rememberVenueImage([next.id, next.providerPlaceId], buildVenueImageUrl(next) ?? next.imageUrl);
    setVenue(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const beginShyne = useCallback(
    (
      next: Venue,
      extras?: {
        ttlMinutes?: number;
        displayName?: string;
        avatarUrl?: string;
        age?: number;
        vibe?: ShyTextVibe;
      }
    ) => {
      const optimistic = buildOptimisticCheckIn(next, extras);
      markPendingShyne({ venueId: next.id, checkIn: optimistic, venue: next });
      rememberVenueImage([next.id, next.providerPlaceId], buildVenueImageUrl(next) ?? next.imageUrl);
      setVenue(next);
      setShyneVenue(next);
      setCheckIn(optimistic);
      void AsyncStorage.setItem(KEY, JSON.stringify(next));
    },
    []
  );

  const checkInHere = useCallback(
    async (
      next: Venue,
      lat?: number,
      lon?: number,
      extras?: {
        ttlMinutes?: number;
        displayName?: string;
        avatarUrl?: string;
        age?: number;
        vibe?: ShyTextVibe;
      }
    ) => {
      const existing = getPendingShyne(next.id)?.checkIn;
      const optimistic = existing ?? buildOptimisticCheckIn(next, extras);
      if (!isPendingShyne(next.id)) {
        markPendingShyne({ venueId: next.id, checkIn: optimistic, venue: next });
      }
      rememberVenueImage([next.id, next.providerPlaceId], buildVenueImageUrl(next) ?? next.imageUrl);
      setVenue(next);
      setShyneVenue(next);
      setCheckIn((prev) => (prev?.venueId === next.id ? prev : optimistic));
      try {
        const vibe =
          extras?.vibe ??
          (optimistic.vibe as ShyTextVibe | undefined) ??
          ((await AsyncStorage.getItem(VIBE_KEY)) as ShyTextVibe | null) ??
          'chat';
        const { checkIn: created, venue: internal } = await checkInToVenue(next, lat, lon, {
          ...extras,
          vibe,
          status: vibe === 'other' ? optimistic.status : undefined,
        });
        clearPendingShyne(next.id);
        setVenue(internal);
        setShyneVenue(internal);
        setCheckIn(created);
        await AsyncStorage.setItem(KEY, JSON.stringify(internal));
        await AsyncStorage.setItem(VIBE_KEY, vibe);
        return created;
      } catch (err) {
        setPendingShyneError(next.id, err instanceof Error ? err.message : 'Could not check in');
        setCheckIn((prev) => (prev?.id.startsWith('pending:') ? null : prev));
        setShyneVenue((prev) => (prev?.id === next.id && !getPendingShyne(next.id) ? null : prev));
        throw err;
      }
    },
    []
  );

  const setVibe = useCallback(async (vibe: ShyTextVibe, status?: string | null) => {
    let wasPending = false;
    setCheckIn((current) => {
      if (!current) return current;
      wasPending = current.id.startsWith('pending:');
      const resolvedStatus =
        vibe !== 'other' ? undefined : status === undefined ? current.status : status || undefined;
      if (wasPending) patchPendingCheckIn({ vibe, status: resolvedStatus });
      return { ...current, vibe, status: resolvedStatus };
    });
    await AsyncStorage.setItem(VIBE_KEY, vibe);
    if (wasPending) return;
    await updateCheckInVibe(vibe, status);
  }, []);

  const leave = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    clearPendingShyne();
    if (uid) await expireMyCheckIns(uid);
    await syncCheckInEndingNotice(null);
    setCheckIn(null);
    setShyneVenue(null);
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const expired = !!checkIn && checkIn.expiresAt <= now;

  return {
    venue,
    shyneVenue,
    checkIn,
    loading,
    expired,
    beginShyne,
    checkInHere,
    leave,
    setVibe,
    setVenue,
    rememberVenue,
  };
}
