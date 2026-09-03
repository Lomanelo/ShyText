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
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from './firebase';
import { ChatMessage, ChatRequest, Conversation } from '../types/chat';
import { moderateText } from './moderation';
import { CHAT_SEND_MS, MAX_REQUESTS_PER_HOUR, REQUEST_REPLY_LOCK_MS } from '../utils/config';
import { isChatSendingOpen } from '../utils/chatTime';
import { isBlockedEitherWay } from './blocks';
import { notifyUser } from './notifications';
import { getUserProfile } from './auth';
import { getActiveCheckIn } from './venues';
import { prefetchProfileImage } from './imageCache';
import i18n from '../i18n';

function isDenied(err: unknown) {
  return err instanceof FirebaseError && err.code === 'permission-denied';
}

function requestDocId(senderId: string, receiverId: string, venueId: string) {
  return `${senderId}_${receiverId}_${venueId}`;
}

function pairKey(ids: string[]) {
  return [...ids].sort().join(':');
}

function dedupeConversations(items: Conversation[]) {
  const best = new Map<string, Conversation>();
  for (const item of items) {
    const key = pairKey(item.participantIds);
    const prev = best.get(key);
    if (!prev || item.lastMessageAt > prev.lastMessageAt) best.set(key, item);
  }
  return [...best.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

async function findOpenConversation(userId: string, otherId: string): Promise<Conversation | null> {
  const snap = await getDocs(
    query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId))
  );
  const open = snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as Conversation))
    .filter((item) => item.status === 'active' && item.participantIds.includes(otherId))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return open[0] ?? null;
}

export async function sendChatRequest(input: {
  checkInId?: string;
  shytextId?: string;
  shytextMessage?: string;
  shytextIntent?: string;
  receiverId: string;
  venueId: string;
  venueName?: string;
  senderName: string;
  senderAvatarUrl?: string;
  introMessage?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  if (user.uid === input.receiverId) throw new Error(i18n.t('errors.cannotSelf'));
  if (await isBlockedEitherWay(user.uid, input.receiverId)) {
    throw new Error(i18n.t('errors.cannotContact'));
  }

  const mine = await getActiveCheckIn(user.uid);
  if (!mine || mine.venueId !== input.venueId || mine.expiresAt <= Date.now()) {
    throw new Error(i18n.t('errors.checkInHereFirst'));
  }
  const theirs = await getActiveCheckIn(input.receiverId);
  if (!theirs || theirs.venueId !== input.venueId || theirs.expiresAt <= Date.now()) {
    throw new Error(i18n.t('errors.noLongerCheckedIn'));
  }

  if (input.introMessage) {
    const moderated = moderateText(input.introMessage);
    if (!moderated.ok) throw new Error(moderated.reason);
  }

  const existingSnap = await getDocs(
    query(collection(db, 'chatRequests'), where('senderId', '==', user.uid))
  ).catch((err) => {
    if (isDenied(err)) return null;
    throw err;
  });
  const existingDocs = existingSnap?.docs ?? [];
  if (
    existingDocs.some(
      (item) =>
        (item.data().status === 'pending' || item.data().status === 'accepted') &&
        item.data().receiverId === input.receiverId &&
        item.data().venueId === input.venueId
    )
  ) {
    throw new Error(i18n.t('errors.alreadySent'));
  }

  const hourCount = existingDocs.filter((item) => Date.now() - Number(item.data().createdAt) < 60 * 60 * 1000).length;
  if (hourCount >= MAX_REQUESTS_PER_HOUR) {
    throw new Error(i18n.t('errors.tooManyHour'));
  }

  // Mutual exclusivity: if they already asked you, accept theirs instead of sending a second request.
  const inboundRef = doc(db, 'chatRequests', requestDocId(input.receiverId, user.uid, input.venueId));
  const inboundSnap = await getDoc(inboundRef).catch((err) => {
    if (isDenied(err)) return null;
    throw err;
  });
  const inboundPending =
    inboundSnap?.exists() && inboundSnap.data().status === 'pending'
      ? ({ id: inboundSnap.id, ...inboundSnap.data() } as ChatRequest)
      : null;
  const inboundAccepted =
    inboundSnap?.exists() && inboundSnap.data().status === 'accepted'
      ? ({ id: inboundSnap.id, ...inboundSnap.data() } as ChatRequest)
      : null;

  if (inboundAccepted) {
    throw new Error(i18n.t('errors.theyAlreadyAccepted'));
  }

  if (inboundPending) {
    const age = Date.now() - inboundPending.createdAt;
    if (age < REQUEST_REPLY_LOCK_MS) {
      throw new Error(i18n.t('errors.theyAlreadySent'));
    }
    // After the lock window, their unanswered note no longer blocks you.
    await updateDoc(inboundRef, { status: 'cancelled' }).catch(() => undefined);
  }

  const ref = doc(db, 'chatRequests', requestDocId(user.uid, input.receiverId, input.venueId));
  const already = await getDoc(ref).catch((err) => {
    if (isDenied(err)) return null;
    throw err;
  });
  if (already?.exists() && (already.data().status === 'pending' || already.data().status === 'accepted')) {
    throw new Error(i18n.t('errors.alreadySent'));
  }

  const payload = Object.fromEntries(
    Object.entries({
      checkInId: theirs.id,
      shytextId: input.shytextId ?? theirs.id,
      shytextIntent: input.shytextIntent ?? null,
      receiverId: input.receiverId,
      venueId: input.venueId,
      venueName: input.venueName ?? null,
      senderName: input.senderName,
      senderAvatarUrl: input.senderAvatarUrl ?? null,
      introMessage: input.introMessage ?? null,
      senderId: user.uid,
      status: 'pending',
      createdAt: Date.now(),
      serverCreatedAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined)
  );
  if (already?.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
  await notifyUser(
    input.receiverId,
    { titleKey: 'push.shytextTitle', bodyKey: 'push.openToRead', data: { type: 'shytext' } },
    'shytexts'
  ).catch(() => undefined);
}

export function listenRequests(userId: string, onChange: (items: ChatRequest[]) => void) {
  const incoming = query(collection(db, 'chatRequests'), where('receiverId', '==', userId));
  return onSnapshot(
    incoming,
    (snap) => {
      const items = snap.docs
        .map((item) => ({ id: item.id, ...item.data() } as ChatRequest))
        .sort((a, b) => b.createdAt - a.createdAt);
      const unique = new Map<string, ChatRequest>();
      for (const item of items) {
        const key = `${item.senderId}:${item.venueId}`;
        if (!unique.has(key)) unique.set(key, item);
        prefetchProfileImage([item.senderId, item.senderAvatarUrl], item.senderAvatarUrl);
      }
      onChange([...unique.values()]);
    },
    () => undefined
  );
}

export function listenOutgoingRequests(userId: string, onChange: (items: ChatRequest[]) => void) {
  const outgoing = query(collection(db, 'chatRequests'), where('senderId', '==', userId));
  return onSnapshot(
    outgoing,
    (snap) => {
      onChange(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ChatRequest)));
    },
    () => undefined
  );
}

export async function respondToRequest(request: ChatRequest, accept: boolean): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || user.uid !== request.receiverId) throw new Error(i18n.t('errors.notAllowed'));
  const ref = doc(db, 'chatRequests', request.id);
  if (!accept) {
    await updateDoc(ref, { status: 'declined' });
    return null;
  }

  const existing = await findOpenConversation(user.uid, request.senderId);
  const now = Date.now();
  const intro = request.introMessage?.trim() || 'Hi';
  let convoId = existing?.id;
  if (!convoId) {
    const created = await addDoc(collection(db, 'conversations'), {
      participantIds: [request.senderId, request.receiverId],
      createdFromShytextId: request.checkInId ?? request.shytextId,
      venueName: request.venueName ?? null,
      otherName: request.senderName ?? null,
      otherAvatarUrl: request.senderAvatarUrl ?? null,
      introMessage: intro,
      introSenderId: request.senderId,
      createdAt: now,
      sendUntil: now + CHAT_SEND_MS,
      lastMessageAt: now,
      lastMessage: intro,
      lastSenderId: request.senderId,
      status: 'active',
      serverCreatedAt: serverTimestamp(),
    });
    convoId = created.id;
  } else if (intro && !existing?.introMessage) {
    await updateDoc(doc(db, 'conversations', convoId), {
      introMessage: intro,
      introSenderId: request.senderId,
    }).catch(() => undefined);
  }
  if (!convoId) throw new Error(i18n.t('errors.couldNotAccept'));

  await updateDoc(ref, { status: 'accepted', conversationId: convoId });
  await updateDoc(doc(db, 'users', user.uid), { 'stats.chatsStarted': increment(1) }).catch(() => undefined);
  await notifyUser(
    request.senderId,
    { titleKey: 'push.acceptedTitle', bodyKey: 'push.acceptedBody', data: { type: 'accepted', chatId: convoId } },
    'accepted'
  ).catch(() => undefined);
  return convoId;
}

export function listenConversation(conversationId: string, onChange: (item: Conversation | null) => void) {
  return onSnapshot(
    doc(db, 'conversations', conversationId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange({ id: snap.id, ...snap.data() } as Conversation);
    },
    () => onChange(null)
  );
}

export function listenConversations(userId: string, onChange: (items: Conversation[]) => void) {
  const q = query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((item) => ({ id: item.id, ...item.data() } as Conversation))
        .sort((a, b) => Number(b.lastMessageAt || 0) - Number(a.lastMessageAt || 0));
      const unique = dedupeConversations(items);
      for (const item of unique) {
        prefetchProfileImage([item.otherAvatarUrl], item.otherAvatarUrl);
      }
      onChange(unique);
    },
    () => onChange([])
  );
}

/** Re-open a left chat so it shows in the list and can receive messages again. */
export async function ensureConversationOpen(conversationId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const ref = doc(db, 'conversations', conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(i18n.t('errors.chatNotFound'));
  const data = snap.data() as Conversation;
  if (!data.participantIds?.includes(user.uid)) throw new Error(i18n.t('errors.notAllowed'));
  if (data.status === 'closed') {
    const now = Date.now();
    await updateDoc(ref, {
      status: 'active',
      sendUntil: now + CHAT_SEND_MS,
      lastMessageAt: Math.max(Number(data.lastMessageAt) || 0, now),
    });
  }
  return conversationId;
}

export function listenMessages(conversationId: string, onChange: (items: ChatMessage[]) => void) {
  const q = collection(db, 'conversations', conversationId, 'messages');
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((item) => ({ id: item.id, conversationId, ...item.data() } as ChatMessage))
        .sort((a, b) => a.createdAt - b.createdAt);
      onChange(items);
    },
    () => undefined
  );
}

export async function sendMessage(conversationId: string, text: string) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.notSignedIn'));
  const snap = await getDoc(doc(db, 'conversations', conversationId));
  if (!snap.exists()) throw new Error(i18n.t('errors.chatNotFound'));
  const convo = { id: snap.id, ...snap.data() } as Conversation;
  if (!isChatSendingOpen(convo)) {
    throw new Error(i18n.t('errors.chatWrapped'));
  }
  const moderated = moderateText(text);
  if (!moderated.ok) throw new Error(moderated.reason);
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    senderId: user.uid,
    text: text.trim(),
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: text.trim(),
    lastMessageAt: Date.now(),
    lastSenderId: user.uid,
  });
  const otherId = convo.participantIds.find((id) => id !== user.uid);
  if (otherId) {
    void (async () => {
      const profile = await getUserProfile(user.uid).catch(() => null);
      const senderName = profile?.displayName?.trim() || user.displayName?.trim() || i18n.t('common.someone');
      await notifyUser(
        otherId,
        {
          titleKey: 'push.chatTitle',
          bodyKey: 'push.chatBody',
          titleParams: { name: senderName },
          data: { type: 'chat', chatId: conversationId },
        },
        'chats'
      );
    })();
  }
}

export async function closeConversation(conversationId: string) {
  await updateDoc(doc(db, 'conversations', conversationId), { status: 'closed' });
}
