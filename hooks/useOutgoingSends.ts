import { useEffect, useMemo, useState } from 'react';
import { listenOutgoingRequests } from '../services/chat';

export function useOutgoingSends(userId?: string, venueId?: string) {
  const [requests, setRequests] = useState<{ receiverId: string; venueId: string; status: string }[]>([]);
  const [local, setLocal] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!userId) return;
    return listenOutgoingRequests(userId, (items) => {
      setRequests(
        items.map((item) => ({
          receiverId: item.receiverId,
          venueId: item.venueId,
          status: item.status,
        }))
      );
    });
  }, [userId]);

  const sentIds = useMemo(() => {
    const next = new Set<string>();
    for (const item of requests) {
      if (venueId && item.venueId !== venueId) continue;
      if (item.status === 'pending' || item.status === 'accepted') next.add(item.receiverId);
    }
    for (const id of Object.keys(local)) next.add(id);
    return next;
  }, [requests, venueId, local]);

  return {
    sentIds,
    markSent: (receiverId: string) => setLocal((prev) => ({ ...prev, [receiverId]: true })),
  };
}
