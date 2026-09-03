import { useEffect, useMemo, useState } from 'react';
import { ChatRequest } from '../types/chat';
import { listenOutgoingRequests, listenRequests } from '../services/chat';
import { REQUEST_REPLY_LOCK_MS } from '../utils/config';

export type VenueContactMode =
  | { kind: 'send' }
  | { kind: 'sent' }
  | { kind: 'accept'; request: ChatRequest }
  | { kind: 'chat'; conversationId?: string };

/**
 * LinkedIn / Discord pattern: one open ask between two people.
 * While their pending note is fresh (< 1h), your CTA is Accept — not Send.
 * After 1h unanswered, you can send your own.
 */
export function useVenueContacts(userId?: string, venueId?: string) {
  const [outgoing, setOutgoing] = useState<ChatRequest[]>([]);
  const [incoming, setIncoming] = useState<ChatRequest[]>([]);
  const [localSent, setLocalSent] = useState<Record<string, true>>({});
  const [localAccepted, setLocalAccepted] = useState<Record<string, true>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const offOut = listenOutgoingRequests(userId, setOutgoing);
    const offIn = listenRequests(userId, setIncoming);
    return () => {
      offOut();
      offIn();
    };
  }, [userId]);

  // Re-evaluate the 1h unlock without needing a remount.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const modes = useMemo(() => {
    const map = new Map<string, VenueContactMode>();
    const now = Date.now();

    for (const item of outgoing) {
      if (venueId && item.venueId !== venueId) continue;
      if (item.status === 'pending' || item.status === 'accepted') {
        map.set(
          item.receiverId,
          item.status === 'accepted'
            ? { kind: 'chat', conversationId: item.conversationId }
            : { kind: 'sent' }
        );
      }
    }

    for (const item of incoming) {
      if (venueId && item.venueId !== venueId) continue;
      if (map.has(item.senderId)) continue;
      if (item.status === 'accepted' || localAccepted[item.senderId]) {
        map.set(item.senderId, { kind: 'chat', conversationId: item.conversationId });
        continue;
      }
      if (item.status === 'pending') {
        const fresh = now - item.createdAt < REQUEST_REPLY_LOCK_MS;
        if (fresh) map.set(item.senderId, { kind: 'accept', request: item });
      }
    }

    for (const id of Object.keys(localSent)) {
      if (!map.has(id)) map.set(id, { kind: 'sent' });
    }
    for (const id of Object.keys(localAccepted)) {
      map.set(id, { kind: 'chat' });
    }

    return map;
  }, [outgoing, incoming, venueId, localSent, localAccepted]);

  return {
    modeFor: (otherUserId: string): VenueContactMode => modes.get(otherUserId) ?? { kind: 'send' },
    markSent: (receiverId: string) => setLocalSent((prev) => ({ ...prev, [receiverId]: true })),
    markAccepted: (senderId: string) => setLocalAccepted((prev) => ({ ...prev, [senderId]: true })),
  };
}
