import { get, push, ref, set, update } from 'firebase/database';
import { auth, database } from './firebase';

export function conversationIdFor(userA: string, userB: string): string {
  const participants = [userA, userB].sort();
  return `conv_${participants.join('_')}`;
}

export async function openOrCreateConversation(
  otherUserId: string,
  source?: { noteId?: string; venueId?: string }
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in.');
  }
  if (otherUserId === currentUser.uid) {
    throw new Error('You cannot message yourself.');
  }

  const conversationId = conversationIdFor(currentUser.uid, otherUserId);
  const conversationRef = ref(database, `conversations/${conversationId}`);
  const snapshot = await get(conversationRef);
  const now = new Date().toISOString();

  if (!snapshot.exists()) {
    const payload = {
      initiatorId: currentUser.uid,
      receiverId: otherUserId,
      createdAt: now,
      lastActive: now,
      sourceNoteId: source?.noteId || null,
      sourceVenueId: source?.venueId || null,
      participants: {
        [currentUser.uid]: true,
        [otherUserId]: true,
      },
    };
    await set(conversationRef, payload);
  }

  await Promise.all([
    set(ref(database, `userConversations/${currentUser.uid}/${conversationId}`), {
      otherUserId,
      updatedAt: now,
    }),
    set(ref(database, `userConversations/${otherUserId}/${conversationId}`), {
      otherUserId: currentUser.uid,
      updatedAt: now,
    }),
  ]);

  return conversationId;
}

export async function touchConversation(conversationId: string, lastMessage: string) {
  const now = new Date().toISOString();
  await update(ref(database, `conversations/${conversationId}`), {
    lastMessage,
    lastMessageTime: now,
    lastActive: now,
  });
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  extra?: Record<string, unknown>
) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in.');
  }
  const messageRef = push(ref(database, `messages/${conversationId}`));
  await set(messageRef, {
    content,
    senderId: currentUser.uid,
    createdAt: new Date().toISOString(),
    read: false,
    ...extra,
  });
  await touchConversation(conversationId, content);
  return messageRef.key;
}
