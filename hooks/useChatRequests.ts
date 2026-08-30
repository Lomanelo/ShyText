import { useEffect, useState } from 'react';
import { ChatRequest } from '../types/chat';
import { listenRequests } from '../services/chat';

export function useChatRequests(userId?: string) {
  const [requests, setRequests] = useState<ChatRequest[]>([]);

  useEffect(() => {
    if (!userId) return;
    return listenRequests(userId, setRequests);
  }, [userId]);

  return {
    incoming: requests.filter((item) => item.status === 'pending'),
    all: requests,
  };
}
