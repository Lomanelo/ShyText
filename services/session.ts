import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteField, doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { expireMyCheckIns } from './venues';
import { clearPendingShyne } from './pendingShyne';
import { syncCheckInEndingNotice } from './notifications';

/** AsyncStorage key owned by useCurrentVenue. */
export const CURRENT_VENUE_KEY = 'currentVenue';

/**
 * End Shyne presence + local session leftovers.
 * Call while Auth is still valid (before firebaseSignOut) so Firestore writes succeed.
 */
export async function clearSessionPresence(uid?: string | null): Promise<void> {
  const userId = uid ?? auth.currentUser?.uid ?? null;

  clearPendingShyne();
  await syncCheckInEndingNotice(null).catch(() => undefined);

  if (userId) {
    await expireMyCheckIns(userId).catch(() => undefined);
    // Stop remote pushes for this device until the next sign-in registers again.
    await setDoc(
      doc(db, 'users', userId, 'private', 'device'),
      { expoPushToken: deleteField(), updatedAt: Date.now() },
      { merge: true }
    ).catch(() => undefined);
  }

  await AsyncStorage.removeItem(CURRENT_VENUE_KEY).catch(() => undefined);
}
