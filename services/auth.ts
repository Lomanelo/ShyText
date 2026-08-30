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
import { auth, db } from './firebase';
import { UserProfile } from '../types/user';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
}

export async function upsertUserProfile(input: {
  id: string;
  displayName: string;
  avatarUrl?: string;
}): Promise<void> {
  const ref = doc(db, 'users', input.id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? existing.data()?.avatarUrl ?? null,
    });
    return;
  }
  await setDoc(ref, {
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
    status: 'active',
    stats: { shytextsPosted: 0, chatsStarted: 0 },
  });
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

export async function completeProfile(displayName: string, avatarUrl?: string, bio?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateProfile(user, { displayName });
  await upsertUserProfile({ id: user.uid, displayName, avatarUrl });
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
