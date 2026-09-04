import { Conversation } from '../types/chat';

/** True when either person can keep sending in this thread (Instagram-style: no timer). */
export function isChatSendingOpen(convo: Pick<Conversation, 'status'>) {
  return convo.status === 'active';
}
