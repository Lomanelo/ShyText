import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type VenueHeatSpot = {
  venueId: string;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  dayKey: string;
};

export function venueHeatDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function heatDocId(dayKey: string, venueId: string) {
  return `${dayKey}_${venueId}`;
}

export async function recordVenueShyText(input: {
  venueId: string;
  name: string;
  latitude?: number;
  longitude?: number;
}) {
  if (input.latitude == null || input.longitude == null || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return;
  }
  const dayKey = venueHeatDayKey();
  const ref = doc(db, 'venueHeat', heatDocId(dayKey, input.venueId));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      count: increment(1),
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      updatedAt: Date.now(),
    });
    return;
  }
  await setDoc(ref, {
    venueId: input.venueId,
    dayKey,
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    count: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function mapSpot(id: string, data: Record<string, unknown>): VenueHeatSpot | null {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const count = Number(data.count);
  const name = String(data.name ?? '').trim();
  const venueId = String(data.venueId ?? id);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || count < 1) return null;
  return {
    venueId,
    name,
    latitude,
    longitude,
    count,
    dayKey: String(data.dayKey ?? ''),
  };
}

export function listenTodayVenueHeat(onChange: (spots: VenueHeatSpot[]) => void) {
  if (!auth.currentUser) {
    onChange([]);
    return () => undefined;
  }
  const q = query(collection(db, 'venueHeat'), where('dayKey', '==', venueHeatDayKey()));
  return onSnapshot(
    q,
    (snap) => {
      const spots = snap.docs
        .map((item) => mapSpot(item.id, item.data()))
        .filter((item): item is VenueHeatSpot => item != null)
        .sort((a, b) => b.count - a.count);
      onChange(spots);
    },
    () => onChange([])
  );
}
