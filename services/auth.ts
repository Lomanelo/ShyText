import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { UserProfile } from '../types/user';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
}

export function sanitizeAge(value?: number): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const age = Math.round(value);
  if (age < 17 || age > 99) return undefined;
  return age;
}

export async function upsertUserProfile(input: {
  id: string;
  displayName: string;
  avatarUrl?: string;
  age?: number;
}): Promise<void> {
  const refDoc = doc(db, 'users', input.id);
  const existing = await getDoc(refDoc);
  const age = sanitizeAge(input.age);
  if (existing.exists()) {
    await updateDoc(refDoc, {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? existing.data()?.avatarUrl ?? null,
      ...(age != null ? { age } : {}),
    });
    return;
  }
  await setDoc(refDoc, {
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    age: age ?? null,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
    status: 'active',
    stats: { shytextsPosted: 0, chatsStarted: 0 },
  });
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const response = await fetch(localUri);
  const blob = await response.blob();
  const file = ref(storage, `avatars/${user.uid}.jpg`);
  await uploadBytes(file, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(file);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogleIdToken(idToken: string) {
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signInWithAppleToken(identityToken: string, nonce: string) {
  const provider = new OAuthProvider('apple.com');
  return signInWithCredential(
    auth,
    provider.credential({ idToken: identityToken, rawNonce: nonce })
  );
}

export async function completeProfile(
  displayName: string,
  avatarUrl?: string,
  bio?: string,
  age?: number
) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateProfile(user, { displayName, photoURL: avatarUrl });
  await upsertUserProfile({ id: user.uid, displayName, avatarUrl, age });
  if (bio != null) {
    await updateDoc(doc(db, 'users', user.uid), { bio });
  }
}

export async function updateOwnProfile(input: { displayName?: string; bio?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateDoc(doc(db, 'users', user.uid), {
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.bio != null ? { bio: input.bio } : {}),
  });
  if (input.displayName) {
    await updateProfile(user, { displayName: input.displayName });
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}
