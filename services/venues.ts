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
import { CheckIn, Venue, VenueCandidate } from '../types/venue';
import { CHECK_IN_MS, isDevToolsEnabled } from '../utils/config';
import { isWithinCheckInRadius } from '../utils/geo';
import { PADDYS_CORNER_ID } from './places';
import { DEMO_VENUES } from './mockData';

function isInternalVenueId(id: string) {
  return Boolean(id) && !id.startsWith('apple:') && !id.startsWith('pending:');
}

export function toVenue(candidate: VenueCandidate, id?: string): Venue {
  return {
    id: id || (candidate.provider === 'demo' ? candidate.providerPlaceId : `${candidate.provider}:${candidate.providerPlaceId}`),
    provider: candidate.provider,
    providerPlaceId: candidate.providerPlaceId,
    name: candidate.name,
    address: candidate.address,
    category: candidate.category,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    distanceMeters: candidate.distanceMeters,
  };
}

export async function findVenuesByProviderPlaceIds(placeIds: string[]): Promise<Map<string, Venue>> {
  const found = new Map<string, Venue>();
  const unique = [...new Set(placeIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, 'venues'), where('providerPlaceId', 'in', batch)));
    snap.forEach((item) => {
      const venue = { id: item.id, ...item.data() } as Venue;
      found.set(venue.providerPlaceId, venue);
    });
  }
  return found;
}

export async function ensureInternalVenue(input: Venue | VenueCandidate): Promise<Venue> {
  if (input.provider === 'demo') {
    const id = 'id' in input && input.id.startsWith('demo-') ? input.id : input.providerPlaceId;
    await setDoc(
      doc(db, 'venues', id),
      {
        provider: 'demo',
        providerPlaceId: input.providerPlaceId,
        name: input.name,
        address: input.address ?? null,
        category: input.category ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
      { merge: true }
    );
    return toVenue(
      {
        provider: 'demo',
        providerPlaceId: input.providerPlaceId,
        name: input.name,
        address: input.address,
        category: input.category,
        latitude: input.latitude ?? 0,
        longitude: input.longitude ?? 0,
        distanceMeters: 'distanceMeters' in input ? input.distanceMeters ?? 0 : 0,
      },
      id
    );
  }

  const existingId = 'id' in input && isInternalVenueId(input.id) ? input.id : undefined;
  if (existingId) {
    const snap = await getDoc(doc(db, 'venues', existingId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Venue;
  }

  const matches = await getDocs(
    query(collection(db, 'venues'), where('providerPlaceId', '==', input.providerPlaceId))
  );
  const reuse = matches.docs[0];
  if (reuse) {
    return { id: reuse.id, ...reuse.data() } as Venue;
  }

  const payload = {
    provider: input.provider,
    providerPlaceId: input.providerPlaceId,
    name: input.name,
    address: input.address ?? null,
    category: input.category ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'venues'), payload);
  return {
    id: ref.id,
    provider: input.provider,
    providerPlaceId: input.providerPlaceId,
    name: input.name,
    address: input.address,
    category: input.category,
    latitude: input.latitude ?? undefined,
    longitude: input.longitude ?? undefined,
  };
}

export async function saveVenue(venue: Venue) {
  const internal = await ensureInternalVenue(venue);
  await setDoc(
    doc(db, 'venues', internal.id),
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
  return internal;
}

export async function checkInToVenue(
  venue: Venue,
  userLat?: number,
  userLon?: number
): Promise<{ checkIn: CheckIn; venue: Venue }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');

  const demoBypass = isDevToolsEnabled() && venue.provider === 'demo';
  if (!demoBypass) {
    if (userLat == null || userLon == null) {
      throw new Error('Location is needed to confirm you’re at this venue.');
    }
    if (venue.latitude != null && venue.longitude != null) {
      if (!isWithinCheckInRadius(userLat, userLon, venue.latitude, venue.longitude)) {
        throw new Error('Move closer to this venue, or pick another nearby place.');
      }
    }
  }

  const internal = await ensureInternalVenue(venue);
  const now = Date.now();
  const payload = {
    userId: user.uid,
    venueId: internal.id,
    createdAt: now,
    expiresAt: now + CHECK_IN_MS,
    serverCreatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'checkins'), payload);
  return { checkIn: { id: ref.id, ...payload }, venue: internal };
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
