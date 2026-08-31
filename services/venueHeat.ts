import { doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function venueHeatDayKey(now = Date.now()) {
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
