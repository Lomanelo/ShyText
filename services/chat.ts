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
import { ChatMessage, ChatRequest, Conversation } from '../types/chat';
import { moderateText } from './moderation';
import { CHAT_SEND_MS, MAX_REQUESTS_PER_HOUR } from '../utils/config';
import { isChatSendingOpen } from '../utils/chatTime';
import { isBlockedEitherWay } from './blocks';
import { notifyUser } from './notifications';
import { getActiveCheckIn } from './venues';
import i18n from '../i18n';

export async function sendChatRequest(input: {
  checkInId?: string;
  shytextId?: string;
  shytextMessage?: string;
  shytextIntent?: string;
  receiverId: string;
  venueId: string;
  venueName?: string;
  senderName: string;
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

  const existing = await getDocs(query(collection(db, 'chatRequests'), where('senderId', '==', user.uid)));
  if (
    existing.docs.some(
      (item) =>
        item.data().status === 'pending' &&
        item.data().receiverId === input.receiverId &&
        item.data().venueId === input.venueId
    )
  ) {
    throw new Error(i18n.t('errors.alreadySent'));
  }

  const hourCount = existing.docs.filter((item) => Date.now() - Number(item.data().createdAt) < 60 * 60 * 1000).length;
  if (hourCount >= MAX_REQUESTS_PER_HOUR) {
    throw new Error(i18n.t('errors.tooManyHour'));
  }

  await addDoc(collection(db, 'chatRequests'), {
    ...input,
    checkInId: theirs.id,
    shytextId: input.shytextId ?? theirs.id,
    senderId: user.uid,
    status: 'pending',
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
  await notifyUser(input.receiverId, { titleKey: 'push.shytextTitle', bodyKey: 'push.openToRead' }, 'shytexts');
}

export function listenRequests(userId: string, onChange: (items: ChatRequest[]) => void) {
  const incoming = query(collection(db, 'chatRequests'), where('receiverId', '==', userId));
  return onSnapshot(
    incoming,
    (snap) => {
      const items = snap.docs
        .map((item) => ({ id: item.id, ...item.data() } as ChatRequest))
        .sort((a, b) => b.createdAt - a.createdAt);
      onChange(items);
    },
    () => onChange([])
  );
}

export async function respondToRequest(request: ChatRequest, accept: boolean): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || user.uid !== request.receiverId) throw new Error(i18n.t('errors.notAllowed'));
  if (accept) {
    const now = Date.now();
    const convo = await addDoc(collection(db, 'conversations'), {
      participantIds: [request.senderId, request.receiverId],
      createdFromShytextId: request.checkInId ?? request.shytextId,
      venueName: request.venueName ?? null,
      createdAt: now,
      sendUntil: now + CHAT_SEND_MS,
      lastMessageAt: now,
      lastMessage: request.introMessage || 'Hi',
      lastSenderId: request.senderId,
      status: 'active',
      serverCreatedAt: serverTimestamp(),
    });
    if (request.introMessage) {
      await addDoc(collection(db, 'conversations', convo.id, 'messages'), {
        senderId: request.senderId,
        text: request.introMessage,
        createdAt: Date.now(),
        serverCreatedAt: serverTimestamp(),
      });
    }
    await updateDoc(doc(db, 'chatRequests', request.id), { status: 'accepted', conversationId: convo.id });
    await updateDoc(doc(db, 'users', user.uid), { 'stats.chatsStarted': increment(1) }).catch(() => undefined);
    await notifyUser(request.senderId, { titleKey: 'push.acceptedTitle', bodyKey: 'push.acceptedBody' }, 'accepted');
    return convo.id;
  }
  await updateDoc(doc(db, 'chatRequests', request.id), { status: 'declined' });
  return null;
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
        .filter((item) => item.status !== 'closed')
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      onChange(items);
    },
    () => onChange([])
  );
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
    () => onChange([])
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
}

export async function closeConversation(conversationId: string) {
  await updateDoc(doc(db, 'conversations', conversationId), { status: 'closed' });
}
