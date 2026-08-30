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
import { ChatMessage, ChatRequest, Conversation } from '../types/chat';
import { moderateText } from './moderation';
import { MAX_REQUESTS_PER_HOUR } from '../utils/config';
import { isBlockedEitherWay } from './blocks';
import { notifyUser } from './notifications';
import { getLiveShyText } from './shytexts';

export async function sendChatRequest(input: {
  shytextId: string;
  shytextMessage?: string;
  shytextIntent?: string;
  receiverId: string;
  venueId: string;
  venueName?: string;
  senderName: string;
  introMessage?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  if (user.uid === input.receiverId) throw new Error('You cannot say hi to yourself.');
  if (await isBlockedEitherWay(user.uid, input.receiverId)) {
    throw new Error('You cannot contact this person.');
  }
  const live = await getLiveShyText(input.shytextId);
  if (!live) throw new Error('They are no longer visible.');
  if (input.introMessage) {
    const moderated = moderateText(input.introMessage);
    if (!moderated.ok) throw new Error(moderated.reason);
  }

  const existing = await getDocs(
    query(
      collection(db, 'chatRequests'),
      where('senderId', '==', user.uid),
      where('shytextId', '==', input.shytextId)
    )
  );
  if (existing.docs.some((item) => item.data().status === 'pending')) {
    throw new Error('You already sent a hi.');
  }

  const hourSnap = await getDocs(query(collection(db, 'chatRequests'), where('senderId', '==', user.uid)));
  const hourCount = hourSnap.docs.filter((item) => Date.now() - Number(item.data().createdAt) < 60 * 60 * 1000).length;
  if (hourCount >= MAX_REQUESTS_PER_HOUR) {
    throw new Error('Too many hellos this hour.');
  }

  await addDoc(collection(db, 'chatRequests'), {
    ...input,
    senderId: user.uid,
    status: 'pending',
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
  await notifyUser(input.receiverId, {
    title: 'Someone wants to say hi',
    body: input.introMessage || 'Open ShyText to read it.',
  });
}

export function listenRequests(userId: string, onChange: (items: ChatRequest[]) => void) {
  const incoming = query(collection(db, 'chatRequests'), where('receiverId', '==', userId));
  return onSnapshot(incoming, (snap) => {
    const items = snap.docs
      .map((item) => ({ id: item.id, ...item.data() } as ChatRequest))
      .sort((a, b) => b.createdAt - a.createdAt);
    onChange(items);
  });
}

export async function respondToRequest(request: ChatRequest, accept: boolean): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || user.uid !== request.receiverId) throw new Error('Not allowed.');
  if (accept) {
    const convo = await addDoc(collection(db, 'conversations'), {
      participantIds: [request.senderId, request.receiverId],
      createdFromShytextId: request.shytextId,
      venueName: request.venueName ?? null,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      lastMessage: request.introMessage || 'Hello',
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
    await updateDoc(doc(db, 'shytexts', request.shytextId), { responseCount: increment(1) }).catch(() => undefined);
    await updateDoc(doc(db, 'users', user.uid), { 'stats.chatsStarted': increment(1) }).catch(() => undefined);
    await notifyUser(request.senderId, {
      title: 'Your hello was accepted',
      body: 'You can chat now.',
    });
    return convo.id;
  }
  await updateDoc(doc(db, 'chatRequests', request.id), { status: 'declined' });
  return null;
}

export function listenConversations(userId: string, onChange: (items: Conversation[]) => void) {
  const q = query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((item) => ({ id: item.id, ...item.data() } as Conversation))
      .filter((item) => item.status !== 'closed')
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    onChange(items);
  });
}

export function listenMessages(conversationId: string, onChange: (items: ChatMessage[]) => void) {
  const q = collection(db, 'conversations', conversationId, 'messages');
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((item) => ({ id: item.id, conversationId, ...item.data() } as ChatMessage))
      .sort((a, b) => a.createdAt - b.createdAt);
    onChange(items);
  });
}

export async function sendMessage(conversationId: string, text: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
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
