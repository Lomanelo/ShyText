import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export async function blockUser(uid: string, blockedId: string) {
  await setDoc(doc(db, 'blocks', `${uid}_${blockedId}`), {
    blockerId: uid,
    blockedId,
    createdAt: Date.now(),
  });
}

export async function unblockUser(uid: string, blockedId: string) {
  await deleteDoc(doc(db, 'blocks', `${uid}_${blockedId}`));
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const [one, two] = await Promise.all([
    getDoc(doc(db, 'blocks', `${a}_${b}`)),
    getDoc(doc(db, 'blocks', `${b}_${a}`)),
  ]);
  return one.exists() || two.exists();
}

export async function listBlockedIds(uid: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid)));
  return snap.docs.map((item) => String(item.data().blockedId));
}
