export type ChatRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface ChatRequest {
  id: string;
  shytextId?: string;
  checkInId?: string;
  shytextMessage?: string;
  shytextIntent?: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  receiverId: string;
  venueId: string;
  venueName?: string;
  introMessage?: string;
  /** Icebreaker key ("vibe.index") when the intro was a suggested text — lets the receiver see it translated. */
  introKey?: string;
  status: ChatRequestStatus;
  createdAt: number;
  conversationId?: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  createdFromShytextId?: string;
  venueName?: string;
  otherName?: string;
  otherAvatarUrl?: string;
  introMessage?: string;
  /** Icebreaker key ("vibe.index") — render the intro in the viewer's language. */
  introMessageKey?: string;
  /** Who wrote the opening ShyText — kept even after lastMessage updates. */
  introSenderId?: string;
  createdAt: number;
  lastMessageAt: number;
  lastMessage?: string;
  lastSenderId?: string;
  status: 'active' | 'closed';
  /** Epoch ms. After this, the thread stays but sending stops. */
  sendUntil?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export type ReportTarget = 'user' | 'shytext' | 'message';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details?: string;
  createdAt: number;
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed';
}
