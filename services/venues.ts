import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { CheckIn, Venue } from '../types/venue';
import { CHECK_IN_MS, isDevToolsEnabled } from '../utils/config';
import { isWithinCheckInRadius } from '../utils/geo';
import { PADDYS_CORNER_ID } from './places';
import { DEMO_VENUES } from './mockData';

export async function saveVenue(venue: Venue) {
  await setDoc(
    doc(db, 'venues', venue.id),
    {
      provider: venue.provider,
      providerPlaceId: venue.providerPlaceId,
      name: venue.name,
      address: venue.address ?? null,
      category: venue.category ?? null,
      latitude: venue.latitude ?? null,
      longitude: venue.longitude ?? null,
    },
    { merge: true }
  );
}

export async function checkInToVenue(venue: Venue, userLat?: number, userLon?: number): Promise<CheckIn> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to check in.');

  const demoBypass = isDevToolsEnabled() && venue.provider === 'demo';
  if (!demoBypass && venue.latitude != null && venue.longitude != null && userLat != null && userLon != null) {
    if (!isWithinCheckInRadius(userLat, userLon, venue.latitude, venue.longitude)) {
      throw new Error('Move closer to this venue, or pick another nearby place.');
    }
  }

  await saveVenue(venue);
  const now = Date.now();
  const payload = {
    userId: user.uid,
    venueId: venue.id,
    createdAt: now,
    expiresAt: now + CHECK_IN_MS,
    serverCreatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'checkins'), payload);
  return { id: ref.id, ...payload };
}

export async function getActiveCheckIn(userId: string): Promise<CheckIn | null> {
  const snap = await getDocs(
    query(collection(db, 'checkins'), where('userId', '==', userId))
  );
  const now = Date.now();
  const live = snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as CheckIn))
    .filter((item) => item.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt);
  return live[0] ?? null;
}

export function isDemoVenue(venueId: string) {
  return venueId === PADDYS_CORNER_ID || venueId.startsWith('demo-');
}

export async function getVenue(venueId: string): Promise<Venue | null> {
  const demo = DEMO_VENUES.find((item) => item.id === venueId);
  if (demo) return demo;
  const snap = await getDoc(doc(db, 'venues', venueId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Venue;
}
