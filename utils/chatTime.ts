import { Conversation } from '../types/chat';
import { CHAT_SEND_MS } from './config';

export function chatSendUntil(convo: Pick<Conversation, 'createdAt' | 'sendUntil'>): number {
  return convo.sendUntil ?? convo.createdAt + CHAT_SEND_MS;
}

export function isChatSendingOpen(convo: Pick<Conversation, 'createdAt' | 'sendUntil' | 'status'>, now = Date.now()) {
  return convo.status === 'active' && chatSendUntil(convo) > now;
}
