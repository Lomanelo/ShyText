import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, type DocumentSnapshot } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

function isDenied(err: unknown) {
  return err instanceof FirebaseError && err.code === 'permission-denied';
}

async function getBlockDoc(id: string): Promise<DocumentSnapshot | null> {
  try {
    return await getDoc(doc(db, 'blocks', id));
  } catch (err) {
    if (isDenied(err)) return null;
    throw err;
  }
}

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
  const [one, two] = await Promise.all([getBlockDoc(`${a}_${b}`), getBlockDoc(`${b}_${a}`)]);
  return Boolean(one?.exists()) || Boolean(two?.exists());
}

export async function listBlockedIds(uid: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid)));
  return snap.docs.map((item) => String(item.data().blockedId));
}
