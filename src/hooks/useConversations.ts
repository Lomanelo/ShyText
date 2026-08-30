import { useEffect, useState } from 'react';
import { get, onValue, ref } from 'firebase/database';
import { auth, database } from '../lib/firebase';

interface UserProfile {
  userId: string;
  firstName?: string;
  photoURL?: string | null;
}

export interface Conversation {
  id: string;
  initiatorId: string;
  receiverId: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherUser?: UserProfile;
  unreadCount?: number;
  participants?: Record<string, boolean>;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setError('You must be logged in');
      return;
    }

    const indexRef = ref(database, `userConversations/${user.uid}`);
    const unsubscribe = onValue(
      indexRef,
      async (snapshot) => {
        try {
          if (!snapshot.exists()) {
            setConversations([]);
            setLoading(false);
            return;
          }

          const ids = Object.keys(snapshot.val());
          const items: Conversation[] = [];

          for (const id of ids) {
            const convoSnap = await get(ref(database, `conversations/${id}`));
            if (!convoSnap.exists()) continue;
            const convo = convoSnap.val();
            if (!convo.participants?.[user.uid]) continue;

            const otherUserId = convo.initiatorId === user.uid ? convo.receiverId : convo.initiatorId;
            const profileSnap = await get(ref(database, `profiles/${otherUserId}`));
            const profile = profileSnap.exists() ? profileSnap.val() : {};

            items.push({
              id,
              ...convo,
              otherUser: {
                userId: otherUserId,
                firstName: profile.firstName || 'User',
                photoURL: profile.photoURL || null,
              },
              lastMessage: convo.lastMessage,
              lastMessageTime: convo.lastMessageTime,
              unreadCount: 0,
            });
          }

          items.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });

          setConversations(items);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setError('Failed to load conversations');
          setLoading(false);
        }
      },
      () => {
        setError('Failed to load conversations');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { conversations, loading, error };
}
