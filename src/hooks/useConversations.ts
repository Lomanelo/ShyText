import { useState, useEffect } from 'react';
import { getDatabase, ref, query, orderByChild, onValue, onChildAdded, get } from 'firebase/database';
import { auth } from '../lib/firebase';

interface Conversation {
  id: string;
  initiatorId: string;
  receiverId: string;
  createdAt: string;
  initiator?: any;
  receiver?: any;
  lastMessage?: string;
  lastMessageTime?: string;
  [key: string]: any;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Get the database
    const db = getDatabase();
    const conversationsRef = ref(db, 'conversations');
    
    // Fetch initial conversations
    fetchConversations();

    // Subscribe to new conversations
    const userConversationsQuery = query(
      conversationsRef,
      orderByChild('participants/' + user.uid),
      // We filter by value equal to true in the query, but Firebase
      // automatically retrieves children where the value is truthy
    );

    const unsubscribe = onValue(userConversationsQuery, (snapshot) => {
      fetchConversations();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function fetchConversations() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const db = getDatabase();
      const conversationsRef = ref(db, 'conversations');
      
      // Query conversations where the current user is a participant
      const userConversationsQuery = query(
        conversationsRef,
        orderByChild('participants/' + user.uid)
        // We filter by value equal to true in the query, but Firebase
        // automatically retrieves children where the value is truthy
      );
      
      const snapshot = await get(userConversationsQuery);
      if (!snapshot.exists()) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      const conversationsData = snapshot.val();
      const conversationsList: Conversation[] = [];
      
      // Process each conversation and get participant profiles
      for (const [id, data] of Object.entries(conversationsData)) {
        const convo = data as any;
        
        // Get the other user's ID (not the current user)
        const otherUserId = convo.initiatorId === user.uid 
          ? convo.receiverId 
          : convo.initiatorId;
        
        // Get the other user's profile
        const otherUserProfileRef = ref(db, `profiles/${otherUserId}`);
        const profileSnapshot = await get(otherUserProfileRef);
        const otherUserProfile = profileSnapshot.exists() ? profileSnapshot.val() : null;
        
        // Get the last message for this conversation
        const messagesRef = ref(db, `messages/${id}`);
        const lastMessageQuery = query(messagesRef, orderByChild('createdAt'));
        const messagesSnapshot = await get(lastMessageQuery);
        
        let lastMessage = null;
        let lastMessageTime = null;
        
        if (messagesSnapshot.exists()) {
          const messages = messagesSnapshot.val();
          const messageKeys = Object.keys(messages);
          if (messageKeys.length > 0) {
            // Get the last message (most recent by timestamp)
            const sortedKeys = messageKeys.sort((a, b) => 
              new Date(messages[b].createdAt).getTime() - new Date(messages[a].createdAt).getTime()
            );
            lastMessage = messages[sortedKeys[0]].content;
            lastMessageTime = messages[sortedKeys[0]].createdAt;
          }
        }
        
        conversationsList.push({
          id,
          ...convo,
          otherUser: otherUserProfile,
          lastMessage,
          lastMessageTime
        });
      }
      
      // Sort conversations by last message time (most recent first)
      const sortedConversations = conversationsList.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      
      setConversations(sortedConversations);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return { conversations, loading, error };
}