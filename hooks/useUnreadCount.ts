import { useMemo } from 'react';
import { useChats } from './useChats';
import { useChatRequests } from './useChatRequests';
import { isConversationUnread } from '../services/chat';

/**
 * Instagram/WhatsApp-style unread total: pending ShyText requests plus
 * conversations where the other person spoke after my last read.
 */
export function useUnreadCount(userId?: string) {
  const { conversations } = useChats(userId);
  const { incoming } = useChatRequests(userId);

  return useMemo(() => {
    if (!userId) return 0;
    const unreadChats = conversations.filter((convo) => isConversationUnread(convo, userId)).length;
    return unreadChats + incoming.length;
  }, [conversations, incoming, userId]);
}
