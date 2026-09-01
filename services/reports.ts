import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ReportTarget } from '../types/chat';
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
}) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInToReport'));
  await addDoc(collection(db, 'reports'), {
    reporterId: user.uid,
    ...input,
    createdAt: Date.now(),
    status: 'open',
    serverCreatedAt: serverTimestamp(),
  });
}
