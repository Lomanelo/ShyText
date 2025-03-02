import { useState, useEffect } from 'react';
import { auth, db, getUserConversations } from '../lib/firebase';
import { collection, query, where, onSnapshot, or, documentId } from 'firebase/firestore';

interface Conversation {
  id: string;
  initiator_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  initiator?: any;
  receiver?: any;
  messages?: any[];
  [key: string]: any;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch initial conversations
    fetchConversations();

    // Set up listeners for conversations where the user is involved
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('initiator_id', '==', user.uid), 
      where('receiver_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      fetchConversations();
    }, (err) => {
      setError(err instanceof Error ? err.message : 'An error occurred');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function fetchConversations() {
    try {
      const data = await getUserConversations();
      
      // Get additional data for each conversation (profiles, messages, etc.)
      // This would need a more complex implementation to get all related data
      
      setConversations(data || []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return { conversations, loading, error };
}