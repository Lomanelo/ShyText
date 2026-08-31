export type ChatRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface ChatRequest {
  id: string;
  shytextId?: string;
  checkInId?: string;
  shytextMessage?: string;
  shytextIntent?: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  venueId: string;
  venueName?: string;
  introMessage?: string;
  status: ChatRequestStatus;
  createdAt: number;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  createdFromShytextId?: string;
  venueName?: string;
  createdAt: number;
  lastMessageAt: number;
  lastMessage?: string;
  lastSenderId?: string;
  status: 'active' | 'closed';
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
