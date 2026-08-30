import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ShyTextCategory, ShyTextPost } from '../types/shytext';
import { moderateText } from './moderation';
import { MAX_ACTIVE_SHYTEXTS, MAX_SHYTEXTS_PER_HOUR } from '../utils/config';
import { getActiveCheckIn } from './venues';
import { isBlockedEitherWay } from './blocks';
import { seedShyTexts } from './mockData';
import { isDevToolsEnabled } from '../utils/config';
import { isDemoVenue } from './venues';

function mapPost(id: string, data: Record<string, unknown>): ShyTextPost {
  return {
    id,
    authorId: String(data.authorId),
    authorName: String(data.authorName ?? 'Someone'),
    authorAvatarUrl: data.authorAvatarUrl ? String(data.authorAvatarUrl) : undefined,
    venueId: String(data.venueId),
    message: String(data.message),
    category: data.category as ShyTextCategory,
    createdAt: Number(data.createdAt),
    expiresAt: Number(data.expiresAt),
    status: (data.status as ShyTextPost['status']) ?? 'active',
    responseCount: Number(data.responseCount ?? 0),
  };
}

export function listenShyTexts(
  venueId: string,
  onChange: (posts: ShyTextPost[]) => void
) {
  const q = query(
    collection(db, 'shytexts'),
    where('venueId', '==', venueId),
    where('status', '==', 'active')
  );
  return onSnapshot(q, async (snap) => {
    const user = auth.currentUser;
    const now = Date.now();
    let posts = snap.docs
      .map((item) => mapPost(item.id, item.data()))
      .filter((item) => item.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (user) {
      const visible: ShyTextPost[] = [];
      for (const post of posts) {
        if (await isBlockedEitherWay(user.uid, post.authorId)) continue;
        visible.push(post);
      }
      posts = visible;
    }

    if (isDevToolsEnabled() && isDemoVenue(venueId) && posts.length === 0) {
      onChange(seedShyTexts(venueId));
      return;
    }
    onChange(posts);
  });
}

export async function createShyText(input: {
  venueId: string;
  message: string;
  category: ShyTextCategory;
  ttlMinutes: number;
  authorName: string;
  authorAvatarUrl?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to post.');
  const checkIn = await getActiveCheckIn(user.uid);
  if (!checkIn || checkIn.venueId !== input.venueId) {
    throw new Error('Check in to this venue first.');
  }
  const moderated = moderateText(input.message);
  if (!moderated.ok) throw new Error(moderated.reason);

  const existing = await getDocs(query(collection(db, 'shytexts'), where('authorId', '==', user.uid)));
  const now = Date.now();
  const mine = existing.docs.map((item) => mapPost(item.id, item.data()));
  const active = mine.filter((item) => item.status === 'active' && item.expiresAt > now);
  if (active.length >= MAX_ACTIVE_SHYTEXTS) {
    throw new Error('You already have 3 active ShyTexts.');
  }
  const lastHour = mine.filter((item) => now - item.createdAt < 60 * 60 * 1000);
  if (lastHour.length >= MAX_SHYTEXTS_PER_HOUR) {
    throw new Error('Slow down — try again in a bit.');
  }

  await addDoc(collection(db, 'shytexts'), {
    authorId: user.uid,
    authorName: input.authorName,
    authorAvatarUrl: input.authorAvatarUrl ?? null,
    venueId: input.venueId,
    message: input.message.trim(),
    category: input.category,
    createdAt: now,
    expiresAt: now + input.ttlMinutes * 60 * 1000,
    status: 'active',
    responseCount: 0,
    serverCreatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', user.uid), {
    'stats.shytextsPosted': increment(1),
  });
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

export async function deleteOwnShyText(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateDoc(doc(db, 'shytexts', id), { status: 'deleted' });
}
