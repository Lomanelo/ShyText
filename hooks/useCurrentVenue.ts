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
import { ShyTextVibe } from '../types/shytext';

const KEY = 'currentVenue';
const VIBE_KEY = 'lastCheckInVibe';

export function useCurrentVenue() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCheckIn: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubCheckIn?.();
      unsubCheckIn = undefined;
      if (!user) {
        setCheckIn(null);
        setLoading(false);
        return;
      }
      unsubCheckIn = listenOwnCheckIn(user.uid, (next) => {
        setCheckIn(next);
        setLoading(false);
        if (next) {
          void getVenue(next.venueId).then((found) => {
            if (found) {
              setVenue(found);
              void AsyncStorage.setItem(KEY, JSON.stringify(found));
            }
          });
        }
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
    setVenue(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

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
      const vibe = extras?.vibe ?? ((await AsyncStorage.getItem(VIBE_KEY)) as ShyTextVibe | null) ?? 'chat';
      const { checkIn: created, venue: internal } = await checkInToVenue(next, lat, lon, { ...extras, vibe });
      setVenue(internal);
      setCheckIn(created);
      await AsyncStorage.setItem(KEY, JSON.stringify(internal));
      await AsyncStorage.setItem(VIBE_KEY, vibe);
      return created;
    },
    []
  );

  const setVibe = useCallback(async (vibe: ShyTextVibe, status?: string | null) => {
    await updateCheckInVibe(vibe, status);
    setCheckIn((current) => {
      if (!current) return current;
      const nextStatus =
        vibe !== 'other' ? undefined : status === undefined ? current.status : status || undefined;
      return { ...current, vibe, status: nextStatus };
    });
    await AsyncStorage.setItem(VIBE_KEY, vibe);
  }, []);

  const leave = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await expireMyCheckIns(uid);
    setCheckIn(null);
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const expired = !!checkIn && checkIn.expiresAt <= now;

  return { venue, checkIn, loading, expired, checkInHere, leave, setVibe, setVenue, rememberVenue };
}
