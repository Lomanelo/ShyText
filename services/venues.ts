import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from './firebase';
import { CheckIn, Venue, VenueCandidate } from '../types/venue';
import { DEFAULT_SHYTEXT_MINUTES, MAX_STATUS_LENGTH, isDevToolsEnabled } from '../utils/config';
import { isWithinCheckInRadius } from '../utils/geo';
import { PADDYS_CORNER_ID } from './places';
import { DEMO_VENUES, seedCheckIns } from './mockData';
import { ShyTextVibe } from '../types/shytext';
import { isBlockedEitherWay } from './blocks';
import { recordVenueShyText } from './venueHeat';
import { moderateText } from './moderation';
import { prefetchProfileImage } from './imageCache';
import { rememberVenueImage } from './venueImageCache';
import i18n from '../i18n';

function isInternalVenueId(id: string) {
  return (
    Boolean(id) &&
    !id.startsWith('apple:') &&
    !id.startsWith('google:') &&
    !id.startsWith('serper:') &&
    !id.startsWith('pending:')
  );
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
    imageUrl: candidate.imageUrl,
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
        imageUrl: input.imageUrl,
      },
      id
    );
  }

  const existingId = 'id' in input && isInternalVenueId(input.id) ? input.id : undefined;
  if (existingId) {
    const snap = await getDoc(doc(db, 'venues', existingId));
    if (snap.exists()) {
      const merged = { id: snap.id, ...snap.data(), imageUrl: input.imageUrl ?? snap.data().imageUrl } as Venue;
      rememberVenueImage([merged.id, merged.providerPlaceId], merged.imageUrl);
      return merged;
    }
  }

  const matches = await getDocs(
    query(collection(db, 'venues'), where('providerPlaceId', '==', input.providerPlaceId))
  );
  const reuse = matches.docs[0];
  if (reuse) {
    const data = reuse.data();
    const imageUrl = input.imageUrl ?? (typeof data.imageUrl === 'string' ? data.imageUrl : undefined);
    if (input.imageUrl && data.imageUrl !== input.imageUrl) {
      void updateDoc(reuse.ref, { imageUrl: input.imageUrl }).catch(() => undefined);
    }
    const merged = { id: reuse.id, ...data, imageUrl } as Venue;
    rememberVenueImage([merged.id, merged.providerPlaceId], imageUrl);
    return merged;
  }

  const payload = {
    provider: input.provider,
    providerPlaceId: input.providerPlaceId,
    name: input.name,
    address: input.address ?? null,
    category: input.category ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    imageUrl: input.imageUrl ?? null,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'venues'), payload);
  const created = {
    id: ref.id,
    provider: input.provider,
    providerPlaceId: input.providerPlaceId,
    name: input.name,
    address: input.address,
    category: input.category,
    latitude: input.latitude ?? undefined,
    longitude: input.longitude ?? undefined,
    imageUrl: input.imageUrl,
  };
  rememberVenueImage([created.id, created.providerPlaceId], created.imageUrl);
  return created;
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
      imageUrl: venue.imageUrl ?? null,
    },
    { merge: true }
  );
  return internal;
}

function isDenied(err: unknown) {
  return err instanceof FirebaseError && err.code === 'permission-denied';
}

function checkInRef(userId: string) {
  return doc(db, 'checkins', userId);
}

export async function expireMyCheckIns(userId: string) {
  const now = Date.now();
  const canonical = checkInRef(userId);
  const mine = await getDoc(canonical).catch((err) => {
    if (isDenied(err)) return null;
    throw err;
  });
  if (mine?.exists() && Number(mine.data().expiresAt) > now) {
    await updateDoc(canonical, { expiresAt: now });
  }
  try {
    const snap = await getDocs(query(collection(db, 'checkins'), where('userId', '==', userId)));
    await Promise.all(
      snap.docs
        .filter((item) => item.id !== userId && Number(item.data().expiresAt) > now)
        .map((item) => updateDoc(item.ref, { expiresAt: now }))
    );
  } catch (err) {
    if (!isDenied(err)) throw err;
  }
}

export async function checkInToVenue(
  venue: Venue,
  userLat?: number,
  userLon?: number,
  extras?: {
    ttlMinutes?: number;
    displayName?: string;
    avatarUrl?: string;
    age?: number;
    vibe?: ShyTextVibe;
    status?: string;
  }
): Promise<{ checkIn: CheckIn; venue: Venue }> {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));

  const demoBypass = isDevToolsEnabled() && venue.provider === 'demo';
  if (!demoBypass) {
    if (userLat == null || userLon == null) {
      throw new Error(i18n.t('errors.locationConfirm'));
    }
    if (venue.latitude != null && venue.longitude != null) {
      if (!isWithinCheckInRadius(userLat, userLon, venue.latitude, venue.longitude)) {
        throw new Error(i18n.t('errors.moveCloser'));
      }
    }
  }

  const internal = await ensureInternalVenue(venue);
  await expireMyCheckIns(user.uid);
  const now = Date.now();
  const ttlMs = (extras?.ttlMinutes ?? DEFAULT_SHYTEXT_MINUTES) * 60 * 1000;
  const payload = {
    userId: user.uid,
    venueId: internal.id,
    createdAt: now,
    expiresAt: now + ttlMs,
    displayName: extras?.displayName ?? null,
    avatarUrl: extras?.avatarUrl ?? null,
    age: extras?.age ?? null,
    vibe: extras?.vibe ?? 'chat',
    status: extras?.vibe === 'other' && extras.status ? extras.status : null,
    serverCreatedAt: serverTimestamp(),
  };
  const ref = checkInRef(user.uid);
  await setDoc(ref, payload);
  await recordVenueShyText({
    venueId: internal.id,
    name: internal.name,
    latitude: internal.latitude,
    longitude: internal.longitude,
  }).catch(() => undefined);
  return {
    checkIn: {
      id: ref.id,
      userId: user.uid,
      venueId: internal.id,
      createdAt: now,
      expiresAt: now + ttlMs,
      displayName: extras?.displayName,
      avatarUrl: extras?.avatarUrl,
      age: extras?.age,
      vibe: extras?.vibe ?? 'chat',
      status: extras?.vibe === 'other' ? extras.status : undefined,
    },
    venue: internal,
  };
}

export async function updateCheckInVibe(vibe: ShyTextVibe, status?: string | null) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const live = await getActiveCheckIn(user.uid);
  if (!live) throw new Error(i18n.t('errors.checkInFirst'));
  const payload: { vibe: ShyTextVibe; status?: string | null } = { vibe };
  if (vibe !== 'other') {
    payload.status = null;
  } else if (status !== undefined) {
    const trimmed = status?.trim() ?? '';
    if (trimmed) {
      const moderated = moderateText(trimmed, { maxLength: MAX_STATUS_LENGTH });
      if (!moderated.ok) throw new Error(moderated.reason);
    }
    payload.status = trimmed || null;
  }
  await updateDoc(checkInRef(user.uid), payload);
}

function isLiveCheckIn(item: CheckIn, now = Date.now()) {
  return item.expiresAt > now;
}

export function mapCheckIn(id: string, data: Record<string, unknown>): CheckIn {
  return {
    id,
    userId: String(data.userId),
    venueId: String(data.venueId),
    createdAt: Number(data.createdAt),
    expiresAt: Number(data.expiresAt),
    displayName: data.displayName ? String(data.displayName) : undefined,
    avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
    age: typeof data.age === 'number' ? data.age : undefined,
    vibe: data.vibe ? String(data.vibe) : undefined,
    status: data.status ? String(data.status) : undefined,
  };
}

export function listenCheckIns(venueId: string, onChange: (people: CheckIn[]) => void) {
  const q = query(collection(db, 'checkins'), where('venueId', '==', venueId));
  return onSnapshot(
    q,
    async (snap) => {
      try {
        const now = Date.now();
        const user = auth.currentUser;
        let people = snap.docs.map((item) => mapCheckIn(item.id, item.data())).filter((item) => isLiveCheckIn(item, now));
        for (const person of people) {
          prefetchProfileImage([person.userId, person.avatarUrl], person.avatarUrl);
        }
        if (user) {
          const visible: CheckIn[] = [];
          for (const person of people) {
            try {
              if (person.userId !== user.uid && (await isBlockedEitherWay(user.uid, person.userId))) continue;
            } catch {
              // Keep the person if the block lookup fails — never fail the whole list.
            }
            visible.push(person);
          }
          people = visible;
        }
        if (isDevToolsEnabled() && isDemoVenue(venueId)) {
          const real = people.filter((item) => !item.userId.startsWith('seed-'));
          const seeds = seedCheckIns(venueId).filter((seed) => !real.some((item) => item.userId === seed.userId));
          people = [...real, ...seeds];
        }
        onChange(people.sort((a, b) => b.createdAt - a.createdAt));
      } catch {
        onChange([]);
      }
    },
    () => onChange([])
  );
}

export async function countActiveCheckIns(venueId: string): Promise<number> {
  try {
    const snap = await getDocs(query(collection(db, 'checkins'), where('venueId', '==', venueId)));
    const now = Date.now();
    const count = snap.docs.filter((item) => Number(item.data().expiresAt) > now).length;
    if (count === 0 && isDevToolsEnabled() && isDemoVenue(venueId)) {
      return seedCheckIns(venueId).length;
    }
    return count;
  } catch (err) {
    if (isDenied(err)) {
      return isDevToolsEnabled() && isDemoVenue(venueId) ? seedCheckIns(venueId).length : 0;
    }
    throw err;
  }
}

export async function getActiveCheckIn(userId: string): Promise<CheckIn | null> {
  try {
    const snap = await getDoc(checkInRef(userId));
    if (!snap.exists()) return null;
    const mapped = mapCheckIn(snap.id, snap.data());
    return mapped.expiresAt > Date.now() ? mapped : null;
  } catch (err) {
    if (isDenied(err)) return null;
    throw err;
  }
}

export function listenOwnCheckIn(userId: string, onChange: (checkIn: CheckIn | null) => void) {
  return onSnapshot(
    checkInRef(userId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const mapped = mapCheckIn(snap.id, snap.data());
      onChange(mapped.expiresAt > Date.now() ? mapped : null);
    },
    () => onChange(null)
  );
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
