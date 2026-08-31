import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Venue } from '../types/venue';
import { CheckIn } from '../types/venue';
import { checkInToVenue, getActiveCheckIn, getVenue } from '../services/venues';
import { auth } from '../services/firebase';

const KEY = 'currentVenue';

export function useCurrentVenue() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setVenue(JSON.parse(raw));
      if (auth.currentUser) {
        const active = await getActiveCheckIn(auth.currentUser.uid);
        setCheckIn(active);
        if (active) {
          const found = await getVenue(active.venueId);
          if (found) setVenue(found);
        }
      }
      setLoading(false);
    })();
  }, []);

  const rememberVenue = useCallback(async (next: Venue) => {
    setVenue(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const checkInHere = useCallback(async (next: Venue, lat?: number, lon?: number) => {
    const { checkIn: created, venue: internal } = await checkInToVenue(next, lat, lon);
    setVenue(internal);
    setCheckIn(created);
    await AsyncStorage.setItem(KEY, JSON.stringify(internal));
    return created;
  }, []);

  const leave = useCallback(async () => {
    setCheckIn(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const expired = !!checkIn && checkIn.expiresAt <= now;

  return { venue, checkIn, loading, expired, checkInHere, leave, setVenue, rememberVenue };
}
