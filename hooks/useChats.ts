import { useEffect, useState } from 'react';
import { Conversation } from '../types/chat';
import { listenConversations } from '../services/chat';

export function useChats(userId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  useEffect(() => {
    if (!userId) return;
    return listenConversations(userId, setConversations);
  }, [userId]);
  return { conversations };
}
