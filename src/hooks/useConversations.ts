import { useState, useEffect } from 'react';
import { getDatabase, ref, query, orderByChild, onValue, equalTo, get } from 'firebase/database';
import { auth } from '../lib/firebase';

interface UserProfile {
  userId: string;
  firstName?: string;
  photoURL?: string | null;
}

interface Conversation {
  id: string;
  initiatorId: string;
  receiverId: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherUser?: UserProfile;
  unreadCount?: number;
  participants?: Record<string, boolean>;
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
      setError("You must be logged in");
      return;
    }

    // Get the database
    const db = getDatabase();
    
    // Fetch initial conversations
    fetchConversations();

    // Listen for changes in conversations
    const conversationsRef = ref(db, 'conversations');
    
    // Simple query for all conversations - we'll filter client-side
    const unsubscribe = onValue(conversationsRef, (snapshot) => {
      if (snapshot.exists()) {
        processConversations(snapshot.val());
      } else {
        setConversations([]);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching conversations:", error);
      setError("Failed to load conversations");
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const processConversations = async (data: Record<string, any>) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const db = getDatabase();
      const conversationsList: Conversation[] = [];
      
      // Process each conversation and get participant profiles
      for (const [id, convo] of Object.entries(data)) {
        // Skip if current user is not a participant
        if (!convo.participants || !convo.participants[user.uid]) {
          continue;
        }
        
        // Get the other user's ID (not the current user)
        const otherUserId = convo.initiatorId === user.uid 
          ? convo.receiverId 
          : convo.initiatorId;
        
        // Get the other user's profile
        const profilePath = 'profiles/' + otherUserId;
        const otherUserProfileRef = ref(db, profilePath);
        const profileSnapshot = await get(otherUserProfileRef);
        
        let otherUser: UserProfile = {
          userId: otherUserId
        };
        
        if (profileSnapshot.exists()) {
          const profileData = profileSnapshot.val();
          otherUser = {
            ...otherUser,
            firstName: profileData.firstName || 'User',
            photoURL: profileData.photoURL || null
          };
        } else {
          // Try fallback to users collection
          const userPath = 'users/' + otherUserId;
          const userRef = ref(db, userPath);
          const userSnapshot = await get(userRef);
          
          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            otherUser = {
              ...otherUser,
              firstName: userData.displayName || 'User',
              photoURL: userData.photoURL || null
            };
          }
        }
        
        // Get the last message for this conversation
        const messagesPath = 'messages/' + id;
        const messagesRef = ref(db, messagesPath);
        const lastMessageQuery = query(messagesRef, orderByChild('createdAt'));
        const messagesSnapshot = await get(lastMessageQuery);
        
        let lastMessage = null;
        let lastMessageTime = null;
        let unreadCount = 0;
        
        if (messagesSnapshot.exists()) {
          const messages = messagesSnapshot.val();
          const messageKeys = Object.keys(messages);
          
          // Count unread messages
          for (const key of messageKeys) {
            const message = messages[key];
            if (message.senderId !== user.uid && !message.read) {
              unreadCount++;
            }
          }
          
          if (messageKeys.length > 0) {
            // Get the last message (most recent by timestamp)
            const sortedKeys = messageKeys.sort((a, b) => 
              new Date(messages[b].createdAt).getTime() - new Date(messages[a].createdAt).getTime()
            );
            lastMessage = messages[sortedKeys[0]].content;
            lastMessageTime = messages[sortedKeys[0]].createdAt;
            
            // Only add conversations that have messages
            conversationsList.push({
              id,
              ...convo,
              otherUser,
              lastMessage,
              lastMessageTime,
              unreadCount
            });
          }
        }
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
      console.error("Error processing conversations:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  async function fetchConversations() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const db = getDatabase();
      const conversationsRef = ref(db, 'conversations');
      
      // Get all conversations and filter client-side
      const snapshot = await get(conversationsRef);
      if (snapshot.exists()) {
        processConversations(snapshot.val());
      } else {
        setConversations([]);
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return { conversations, loading, error };
}