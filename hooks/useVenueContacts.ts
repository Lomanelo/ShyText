import { useEffect, useMemo, useState } from 'react';
import { ChatRequest, Conversation } from '../types/chat';
import { listenConversations, listenOutgoingRequests, listenRequests } from '../services/chat';
import { REQUEST_REPLY_LOCK_MS } from '../utils/config';

export type VenueContactMode =
  | { kind: 'send' }
  | { kind: 'sent' }
  | { kind: 'accept'; request: ChatRequest }
  | { kind: 'chat'; conversationId?: string };

/**
 * Instagram-style contact modes for venue people:
 * 1. Existing thread with them (any venue) → Open chat
 * 2. Pending outbound ShyText → Sent
 * 3. Fresh inbound ShyText → Accept
 * 4. Else → Send ShyText
 */
export function useVenueContacts(userId?: string, venueId?: string) {
  const [outgoing, setOutgoing] = useState<ChatRequest[]>([]);
  const [incoming, setIncoming] = useState<ChatRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [localSent, setLocalSent] = useState<Record<string, true>>({});
  /** Optimistic accept map: otherUserId → conversationId (empty until known). */
  const [localAccepted, setLocalAccepted] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const offOut = listenOutgoingRequests(userId, setOutgoing);
    const offIn = listenRequests(userId, setIncoming);
    const offChats = listenConversations(userId, setConversations);
    return () => {
      offOut();
      offIn();
      offChats();
    };
  }, [userId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const modes = useMemo(() => {
    const map = new Map<string, VenueContactMode>();
    const now = Date.now();

    // 1) Permanent threads win everywhere (not venue-scoped).
    for (const convo of conversations) {
      const other = convo.participantIds?.find((id) => id !== userId);
      if (!other) continue;
      const prev = map.get(other);
      if (prev?.kind === 'chat' && prev.conversationId && convo.status === 'closed') continue;
      map.set(other, { kind: 'chat', conversationId: convo.id });
    }

    for (const [id, conversationId] of Object.entries(localAccepted)) {
      const prev = map.get(id);
      map.set(id, {
        kind: 'chat',
        conversationId: prev?.kind === 'chat' ? prev.conversationId || conversationId || undefined : conversationId || undefined,
      });
    }

    // 2) Outgoing pending / accepted requests (any venue).
    for (const item of outgoing) {
      if (map.has(item.receiverId)) continue;
      if (item.status === 'accepted') {
        map.set(item.receiverId, { kind: 'chat', conversationId: item.conversationId });
        continue;
      }
      if (item.status === 'pending') {
        map.set(item.receiverId, { kind: 'sent' });
      }
    }

    // 3) Incoming pending → Accept (any venue, while fresh).
    for (const item of incoming) {
      if (map.has(item.senderId)) continue;
      if (item.status === 'accepted') {
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

    return map;
    // venueId kept for API stability; modes are intentionally global.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing, incoming, conversations, userId, localSent, localAccepted, venueId]);

  return {
    modeFor: (otherUserId: string): VenueContactMode => modes.get(otherUserId) ?? { kind: 'send' },
    markSent: (receiverId: string) => setLocalSent((prev) => ({ ...prev, [receiverId]: true })),
    markAccepted: (senderId: string, conversationId?: string) =>
      setLocalAccepted((prev) => ({
        ...prev,
        [senderId]: conversationId || prev[senderId] || '',
      })),
  };
}
