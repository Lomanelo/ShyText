import { useCallback, useEffect, useMemo, useState } from 'react';
import { get, onValue, push, ref, remove, set, update } from 'firebase/database';
import * as Location from 'expo-location';
import { auth, database } from '../lib/firebase';
import { encodeGeohash, venueIdFromName } from '../lib/geohash';
import { moderateText } from '../lib/moderation';
import {
  APP_REVIEW_VENUE,
  APP_REVIEW_VENUE_ID,
  NOTE_MAX_LENGTH,
  NOTE_TTL_MS,
  PRESENCE_TTL_MS,
} from '../constants';

export type Venue = {
  id: string;
  name: string;
  city?: string;
  geohash?: string;
  isDemo?: boolean;
};

export type VenueNote = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  expiresAt: number;
};

export const DEMO_NOTES: VenueNote[] = [
  {
    id: 'demo-1',
    authorId: 'demo-maya',
    authorName: 'Maya',
    text: 'First time here — anyone else working on a side project?',
    createdAt: Date.now() - 8 * 60 * 1000,
    expiresAt: Date.now() + NOTE_TTL_MS,
  },
  {
    id: 'demo-2',
    authorId: 'demo-jordan',
    authorName: 'Jordan',
    text: 'The oat latte is excellent. Looking for a table to share.',
    createdAt: Date.now() - 3 * 60 * 1000,
    expiresAt: Date.now() + NOTE_TTL_MS,
  },
];

function isFresh(expiresAt?: number) {
  return typeof expiresAt === 'number' && expiresAt > Date.now();
}

export function useVenue() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [notes, setNotes] = useState<VenueNote[]>([]);
  const [ghostMode, setGhostMode] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const profileUnsub = onValue(ref(database, `profiles/${uid}`), (snap) => {
      setGhostMode(!!snap.val()?.ghostMode);
    });
    const blocksUnsub = onValue(ref(database, `blockedUsers/${uid}`), (snap) => {
      setBlockedIds(new Set(Object.keys(snap.val() || {})));
    });

    return () => {
      profileUnsub();
      blocksUnsub();
    };
  }, [uid]);

  useEffect(() => {
    if (!venue?.id) {
      setNotes([]);
      return;
    }

    const notesUnsub = onValue(ref(database, `notes/${venue.id}`), (snap) => {
      const raw = snap.val() || {};
      const live: VenueNote[] = Object.entries(raw)
        .map(([id, value]: [string, any]) => ({
          id,
          authorId: value.authorId,
          authorName: value.authorName || 'Someone',
          text: value.text,
          createdAt: value.createdAt,
          expiresAt: value.expiresAt,
        }))
        .filter((note) => isFresh(note.expiresAt) && !blockedIds.has(note.authorId))
        .sort((a, b) => b.createdAt - a.createdAt);

      if (venue.id === APP_REVIEW_VENUE_ID && live.length === 0) {
        setNotes(DEMO_NOTES);
      } else {
        setNotes(live);
      }
      setLoading(false);
    });

    return () => notesUnsub();
  }, [venue?.id, blockedIds]);

  const ensureVenueRecord = useCallback(async (next: Venue) => {
    const venueRef = ref(database, `venues/${next.id}`);
    const existing = await get(venueRef);
    if (!existing.exists()) {
      await set(venueRef, {
        name: next.name,
        city: next.city || null,
        geohash: next.geohash || null,
        isDemo: !!next.isDemo,
        createdAt: Date.now(),
      });
    }
  }, []);

  const checkIn = useCallback(
    async (next: Venue, options?: { ghost?: boolean }) => {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in.');

      await ensureVenueRecord(next);
      const expiresAt = Date.now() + PRESENCE_TTL_MS;
      const ghost = options?.ghost ?? ghostMode;

      await Promise.all([
        set(ref(database, `venuePresence/${next.id}/${user.uid}`), {
          expiresAt,
          ghost,
          checkedInAt: Date.now(),
        }),
        set(ref(database, `userPresence/${user.uid}`), {
          venueId: next.id,
          expiresAt,
        }),
      ]);

      setVenue(next);
      setError(null);
    },
    [ensureVenueRecord, ghostMode]
  );

  const leaveVenue = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !venue) return;
    await Promise.all([
      remove(ref(database, `venuePresence/${venue.id}/${user.uid}`)),
      remove(ref(database, `userPresence/${user.uid}`)),
    ]);
    setVenue(null);
  }, [venue]);

  const suggestVenueFromLocation = useCallback(async (): Promise<Venue | null> => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const geohash = encodeGeohash(position.coords.latitude, position.coords.longitude, 6);
    const name = place?.name || place?.street || place?.district || 'This place';
    const city = place?.city || place?.subregion || undefined;
    return {
      id: venueIdFromName(name, geohash),
      name,
      city,
      geohash,
    };
  }, []);

  const joinByCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toLowerCase();
      if (!trimmed) throw new Error('Enter a venue code.');
      if (trimmed === APP_REVIEW_VENUE_ID || trimmed === 'review' || trimmed === 'demo') {
        await checkIn(APP_REVIEW_VENUE);
        return APP_REVIEW_VENUE;
      }
      const existing = await get(ref(database, `venues/${trimmed}`));
      if (existing.exists()) {
        const data = existing.val();
        const next = { id: trimmed, name: data.name, city: data.city, geohash: data.geohash };
        await checkIn(next);
        return next;
      }
      const created: Venue = {
        id: venueIdFromName(trimmed),
        name: code.trim(),
      };
      await checkIn(created);
      return created;
    },
    [checkIn]
  );

  const createManualVenue = useCallback(
    async (name: string, city?: string) => {
      const next: Venue = {
        id: venueIdFromName(name),
        name: name.trim(),
        city,
      };
      await checkIn(next);
      return next;
    },
    [checkIn]
  );

  const postNote = useCallback(
    async (text: string) => {
      const user = auth.currentUser;
      if (!user || !venue) throw new Error('Check in first.');
      if (ghostMode) throw new Error('Turn off Ghost Mode to leave a note.');
      const moderated = moderateText(text);
      if (!moderated.ok) throw new Error(moderated.reason);
      const trimmed = text.trim();
      if (trimmed.length > NOTE_MAX_LENGTH) {
        throw new Error(`Notes can be ${NOTE_MAX_LENGTH} characters.`);
      }

      const profileSnap = await get(ref(database, `profiles/${user.uid}`));
      const authorName = profileSnap.val()?.firstName || 'Someone';
      const now = Date.now();
      const noteRef = push(ref(database, `notes/${venue.id}`));
      const payload = {
        authorId: user.uid,
        authorName,
        text: trimmed,
        createdAt: now,
        expiresAt: now + NOTE_TTL_MS,
      };
      await set(noteRef, payload);
      if (noteRef.key) {
        await set(ref(database, `userNotes/${user.uid}/${venue.id}/${noteRef.key}`), true);
      }
    },
    [venue, ghostMode]
  );

  const toggleGhost = useCallback(async (enabled: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    await update(ref(database, `profiles/${user.uid}`), {
      ghostMode: enabled,
      lastUpdated: new Date().toISOString(),
    });
    if (venue) {
      await update(ref(database, `venuePresence/${venue.id}/${user.uid}`), {
        ghost: enabled,
      });
    }
  }, [venue]);

  const visibleNotes = useMemo(
    () => notes.filter((note) => !blockedIds.has(note.authorId)),
    [notes, blockedIds]
  );

  return {
    venue,
    notes: visibleNotes,
    ghostMode,
    loading,
    error,
    setError,
    checkIn,
    leaveVenue,
    suggestVenueFromLocation,
    joinByCode,
    createManualVenue,
    postNote,
    toggleGhost,
    setVenue,
  };
}
