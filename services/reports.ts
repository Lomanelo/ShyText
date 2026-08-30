import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ReportTarget } from '../types/chat';

export const REPORT_REASONS = [
  'Harassment',
  'Sexual content',
  'Hate or abuse',
  'Spam',
  'Impersonation',
  'Threatening behavior',
  'Other',
];

export async function submitReport(input: {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to report.');
  await addDoc(collection(db, 'reports'), {
    reporterId: user.uid,
    ...input,
    createdAt: Date.now(),
    status: 'open',
    serverCreatedAt: serverTimestamp(),
  });
}
