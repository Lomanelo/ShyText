import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ReportTarget } from '../types/chat';
import { authedPost } from './api';
import i18n from '../i18n';

export const REPORT_REASON_KEYS = [
  'harassment',
  'sexual',
  'hate',
  'spam',
  'impersonation',
  'threatening',
  'other',
] as const;

export type ReportReasonKey = (typeof REPORT_REASON_KEYS)[number];

export async function submitReport(input: {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details?: string;
  venueId?: string;
  conversationId?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInToReport'));

  // System of record.
  await addDoc(collection(db, 'reports'), {
    reporterId: user.uid,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details ?? '',
    venueId: input.venueId ?? null,
    conversationId: input.conversationId ?? null,
    createdAt: Date.now(),
    status: 'open',
    serverCreatedAt: serverTimestamp(),
  });

  // Best-effort email to hello@shytext.com via Netlify + Resend.
  await authedPost('/api/report', {
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details ?? '',
    venueId: input.venueId ?? null,
    conversationId: input.conversationId ?? null,
  }).catch(() => undefined);
}
