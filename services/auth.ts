import {
  PhoneAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  type ApplicationVerifier,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, storage } from './firebase';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs, UserProfile } from '../types/user';
import { MAX_BIO_LENGTH } from '../utils/config';
import { expireMyCheckIns } from './venues';
import { syncCheckInEndingNotice } from './notifications';
import i18n from '../i18n';

export function notificationPrefsOf(profile?: UserProfile | null): NotificationPrefs {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...profile?.notificationPrefs,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
}

/**
 * If Auth is signed in but the Firestore profile was wiped (e.g. failed
 * account delete), recreate a minimal profile from Auth so the app works again.
 */
export async function ensureUserProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const existing = await getUserProfile(user.uid);
  if (existing?.displayName?.trim()) return existing;

  const displayName = (user.displayName || existing?.displayName || '').trim();
  if (!displayName) return existing;

  await upsertUserProfile({
    id: user.uid,
    displayName,
    avatarUrl: user.photoURL || existing?.avatarUrl || undefined,
  });
  return (await getUserProfile(user.uid)) ?? {
    id: user.uid,
    displayName,
    avatarUrl: user.photoURL || undefined,
    createdAt: Date.now(),
    status: 'active',
    stats: { shytextsPosted: 0, chatsStarted: 0 },
  };
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
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    language: i18n.language,
  });
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.notSignedIn'));
  const blob = await readLocalImage(localUri);
  const file = ref(storage, `avatars/${user.uid}.jpg`);
  await uploadBytes(file, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(file);
}

function readLocalImage(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const response = xhr.response as Blob;
      if (!response) {
    reject(new Error(i18n.t('errors.photoRead')));
        return;
      }
      resolve(response);
    };
    xhr.onerror = () => reject(new Error(i18n.t('errors.photoRead')));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export async function sendPhoneVerification(phoneNumber: string, verifier: ApplicationVerifier) {
  const provider = new PhoneAuthProvider(auth);
  return provider.verifyPhoneNumber(phoneNumber, verifier);
}

export async function confirmPhoneVerification(verificationId: string, code: string) {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  return signInWithCredential(auth, credential);
}

/** Current user's E.164 phone, or null if missing. */
export function currentUserPhoneNumber(): string | null {
  return auth.currentUser?.phoneNumber ?? null;
}

/** Send SMS OTP to the signed-in account phone (for delete / sensitive actions). */
export async function sendAccountPhoneVerification(verifier: ApplicationVerifier) {
  const user = auth.currentUser;
  const phone = user?.phoneNumber;
  if (!user || !phone) throw new Error(i18n.t('errors.noPhoneOnAccount'));
  return sendPhoneVerification(phone, verifier);
}

/** Prove possession of the account phone, then allow sensitive ops like deleteUser. */
export async function reauthenticateWithPhoneCode(verificationId: string, code: string) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const credential = PhoneAuthProvider.credential(verificationId, code);
  await reauthenticateWithCredential(user, credential);
}

export async function completeProfile(
  displayName: string,
  avatarUrl?: string,
  bio?: string,
  age?: number
) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.notSignedIn'));
  await updateProfile(user, { displayName, photoURL: avatarUrl });
  await upsertUserProfile({ id: user.uid, displayName, avatarUrl, age });
  if (bio != null) {
    await updateDoc(doc(db, 'users', user.uid), { bio });
  }
  await persistUserLanguage();
}

export async function updateOwnProfile(input: {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  notificationPrefs?: NotificationPrefs;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.notSignedIn'));
  if (input.displayName != null && input.displayName.trim().length < 2) {
    throw new Error(i18n.t('errors.nameMin'));
  }
  if (input.bio != null && input.bio.length > MAX_BIO_LENGTH) {
    throw new Error(i18n.t('errors.bioMax', { count: MAX_BIO_LENGTH }));
  }
  const payload: Record<string, unknown> = {};
  if (input.displayName != null) payload.displayName = input.displayName.trim();
  if (input.bio !== undefined) payload.bio = input.bio?.trim() || null;
  if (input.avatarUrl !== undefined) payload.avatarUrl = input.avatarUrl;
  if (input.notificationPrefs) payload.notificationPrefs = input.notificationPrefs;
  if (Object.keys(payload).length) {
    const refDoc = doc(db, 'users', user.uid);
    const existing = await getDoc(refDoc);
    if (existing.exists()) {
      await updateDoc(refDoc, payload);
    } else {
      await setDoc(refDoc, {
        displayName: input.displayName?.trim() || user.displayName || i18n.t('common.someone'),
        avatarUrl: input.avatarUrl ?? user.photoURL ?? null,
        bio: input.bio?.trim() || null,
        age: null,
        createdAt: Date.now(),
        serverCreatedAt: serverTimestamp(),
        status: 'active',
        stats: { shytextsPosted: 0, chatsStarted: 0 },
        notificationPrefs: input.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS,
        language: i18n.language,
        ...payload,
      });
    }
  }
  if (input.displayName != null || input.avatarUrl !== undefined) {
    await updateProfile(user, {
      ...(input.displayName != null ? { displayName: input.displayName.trim() } : {}),
      ...(input.avatarUrl !== undefined ? { photoURL: input.avatarUrl || '' } : {}),
    });
  }
}

export async function removeOwnAvatar() {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.notSignedIn'));
  try {
    await deleteObject(ref(storage, `avatars/${user.uid}.jpg`));
  } catch {
    // Missing file is fine — still clear the profile field.
  }
  await updateOwnProfile({ avatarUrl: null });
}

export async function deleteOwnAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const uid = user.uid;
  const profileSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const profileData = profileSnap?.exists() ? profileSnap.data() : null;

  await expireMyCheckIns(uid).catch(() => undefined);
  await syncCheckInEndingNotice(null).catch(() => undefined);
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`));
  } catch {
    // No photo stored.
  }

  // Wipe Firestore only after we can still roll it back if Auth delete fails.
  if (profileSnap?.exists()) {
    await deleteDoc(doc(db, 'users', uid));
  }
  await AsyncStorage.clear().catch(() => undefined);
  try {
    await deleteUser(user);
  } catch (err) {
    if (profileData) {
      await setDoc(doc(db, 'users', uid), profileData).catch(() => undefined);
    }
    if (err instanceof FirebaseError && err.code === 'auth/requires-recent-login') {
      throw new Error(i18n.t('errors.recentLogin'));
    }
    throw err;
  }
}

export async function persistUserLanguage() {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), { language: i18n.language }).catch(() => undefined);
}

export async function signOut() {
  await firebaseSignOut(auth);
}
