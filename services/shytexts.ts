import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { normalizeVibe, ShyTextPost, ShyTextVibe } from '../types/shytext';
import { moderateText } from './moderation';
import { MAX_SHYTEXTS_PER_HOUR, MAX_SHYTEXT_MESSAGE_LENGTH } from '../utils/config';
import { checkInToVenue, getActiveCheckIn, getVenue, isDemoVenue } from './venues';
import { Venue } from '../types/venue';
import { isBlockedEitherWay } from './blocks';
import { seedShyTexts } from './mockData';
import { isDevToolsEnabled } from '../utils/config';
import { recordVenueShyText } from './venueHeat';

export function mapShyText(id: string, data: Record<string, unknown>): ShyTextPost {
  const vibe = normalizeVibe(data.vibe ?? data.intent ?? data.category);
  const authorId = String(data.userId ?? data.authorId);
  const message = data.message == null ? undefined : String(data.message);
  const bio = data.authorBio == null ? undefined : String(data.authorBio).trim();
  return {
    id,
    userId: authorId,
    authorId,
    authorName: String(data.authorName ?? 'Someone'),
    authorAvatarUrl: data.authorAvatarUrl ? String(data.authorAvatarUrl) : undefined,
    authorAge: typeof data.authorAge === 'number' ? data.authorAge : undefined,
    authorBio: bio || undefined,
    venueId: String(data.venueId),
    vibe,
    intent: vibe,
    category: vibe,
    message: message?.trim() ? message.trim() : undefined,
    createdAt: Number(data.createdAt),
    expiresAt: Number(data.expiresAt),
    status: (data.status as ShyTextPost['status']) ?? 'active',
    visibilityMode: data.visibilityMode === 'shy' ? 'shy' : 'open',
    responseCount: Number(data.responseCount ?? 0),
  };
}

function isLive(item: ShyTextPost, now = Date.now()) {
  return item.status === 'active' && item.expiresAt > now;
}

export function listenShyTexts(venueId: string, onChange: (posts: ShyTextPost[]) => void) {
  const q = query(
    collection(db, 'shytexts'),
    where('venueId', '==', venueId),
    where('status', '==', 'active')
  );
  return onSnapshot(q, async (snap) => {
    const user = auth.currentUser;
    const now = Date.now();
    let posts = snap.docs
      .map((item) => mapShyText(item.id, item.data()))
      .filter((item) => isLive(item, now))
      .sort((a, b) => b.createdAt - a.createdAt);

    if (user) {
      const visible: ShyTextPost[] = [];
      for (const post of posts) {
        if (await isBlockedEitherWay(user.uid, post.authorId)) continue;
        visible.push(post);
      }
      posts = visible;
    }

    if (isDevToolsEnabled() && isDemoVenue(venueId)) {
      const real = posts.filter((item) => !item.authorId.startsWith('seed-'));
      const seeds = seedShyTexts(venueId).filter(
        (seed) => !real.some((item) => item.authorId === seed.authorId)
      );
      onChange(
        [...real, ...seeds].sort((a, b) => b.createdAt - a.createdAt)
      );
      return;
    }
    onChange(posts);
  }, () => onChange([]));
}

export async function listMyActiveShyTexts(userId: string): Promise<ShyTextPost[]> {
  const snap = await getDocs(query(collection(db, 'shytexts'), where('authorId', '==', userId)));
  const now = Date.now();
  return snap.docs
    .map((item) => mapShyText(item.id, item.data()))
    .filter((item) => isLive(item, now));
}

async function stopActiveForUser(userId: string) {
  const live = await listMyActiveShyTexts(userId);
  await Promise.all(live.map((item) => updateDoc(doc(db, 'shytexts', item.id), { status: 'stopped' })));
}

export async function activateShyText(input: {
  venueId: string;
  vibe: ShyTextVibe;
  message?: string;
  ttlMinutes: number;
  authorName: string;
  authorAvatarUrl?: string;
  authorAge?: number;
  authorBio?: string;
  venue?: Venue;
  userLat?: number;
  userLon?: number;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  if (input.venue && input.userLat != null && input.userLon != null) {
    await checkInToVenue(input.venue, input.userLat, input.userLon);
  } else {
    const checkIn = await getActiveCheckIn(user.uid);
    if (!checkIn || checkIn.venueId !== input.venueId) {
      throw new Error('Move closer to this venue to drop a ShyText.');
    }
  }
  const moderated = moderateText(input.message ?? '', {
    allowEmpty: true,
    maxLength: MAX_SHYTEXT_MESSAGE_LENGTH,
  });
  if (!moderated.ok) throw new Error(moderated.reason);

  const existing = await getDocs(query(collection(db, 'shytexts'), where('authorId', '==', user.uid)));
  const now = Date.now();
  const mine = existing.docs.map((item) => mapShyText(item.id, item.data()));
  const lastHour = mine.filter((item) => now - item.createdAt < 60 * 60 * 1000);
  if (lastHour.length >= MAX_SHYTEXTS_PER_HOUR) {
    throw new Error('Slow down — try again in a bit.');
  }

  await stopActiveForUser(user.uid);

  await addDoc(collection(db, 'shytexts'), {
    userId: user.uid,
    authorId: user.uid,
    authorName: input.authorName,
    authorAvatarUrl: input.authorAvatarUrl ?? null,
    authorAge: input.authorAge ?? null,
    authorBio: input.authorBio?.trim() || null,
    venueId: input.venueId,
    vibe: input.vibe,
    intent: input.vibe,
    category: input.vibe,
    message: input.message?.trim() || null,
    createdAt: now,
    expiresAt: now + input.ttlMinutes * 60 * 1000,
    status: 'active',
    visibilityMode: 'open',
    responseCount: 0,
    serverCreatedAt: serverTimestamp(),
  });
  const heatVenue = input.venue ?? (await getVenue(input.venueId));
  if (heatVenue) {
    await recordVenueShyText({
      venueId: input.venueId,
      name: heatVenue.name,
      latitude: heatVenue.latitude,
      longitude: heatVenue.longitude,
    }).catch(() => undefined);
  }
  await updateDoc(doc(db, 'users', user.uid), {
    'stats.shytextsPosted': increment(1),
  }).catch(() => undefined);
}

export async function countActiveShyTexts(venueId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'shytexts'), where('venueId', '==', venueId), where('status', '==', 'active'))
  );
  const now = Date.now();
  const count = snap.docs.filter((item) => Number(item.data().expiresAt) > now).length;
  if (count === 0 && isDevToolsEnabled() && isDemoVenue(venueId)) {
    return seedShyTexts(venueId).length;
  }
  return count;
}

export async function takeDownShyText(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateDoc(doc(db, 'shytexts', id), { status: 'stopped' });
}

export async function takeDownMyShyTexts() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await stopActiveForUser(user.uid);
}

/** @deprecated Use takeDownShyText. */
export const stopVisibility = takeDownShyText;

export async function getLiveShyText(id: string): Promise<ShyTextPost | null> {
  const snap = await getDoc(doc(db, 'shytexts', id));
  if (!snap.exists()) return null;
  const post = mapShyText(snap.id, snap.data());
  return isLive(post) ? post : null;
}
