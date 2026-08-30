import { deleteUser } from 'firebase/auth';
import { get, ref, remove, update } from 'firebase/database';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, database, storage } from './firebase';

async function removeIfExists(path: string) {
  try {
    await remove(ref(database, path));
  } catch (error) {
    console.warn('Failed to remove', path, error);
  }
}

export async function cascadeDeleteAccount() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }

  const uid = user.uid;

  const [conversationsSnap, notesIndexSnap, presenceSnap] = await Promise.all([
    get(ref(database, `userConversations/${uid}`)),
    get(ref(database, `userNotes/${uid}`)),
    get(ref(database, `userPresence/${uid}`)),
  ]);

  if (conversationsSnap.exists()) {
    const conversationIds = Object.keys(conversationsSnap.val());
    for (const conversationId of conversationIds) {
      const convoSnap = await get(ref(database, `conversations/${conversationId}`));
      const participants = convoSnap.exists() ? convoSnap.val().participants || {} : {};
      await removeIfExists(`messages/${conversationId}`);
      await removeIfExists(`conversations/${conversationId}`);
      await removeIfExists(`activeChats/${conversationId}`);
      for (const participantId of Object.keys(participants)) {
        await removeIfExists(`userConversations/${participantId}/${conversationId}`);
      }
    }
  }

  if (notesIndexSnap.exists()) {
    const byVenue = notesIndexSnap.val() as Record<string, Record<string, boolean>>;
    for (const [venueId, notes] of Object.entries(byVenue)) {
      for (const noteId of Object.keys(notes || {})) {
        await removeIfExists(`notes/${venueId}/${noteId}`);
      }
    }
  }

  if (presenceSnap.exists()) {
    const venueId = presenceSnap.val()?.venueId;
    if (venueId) {
      await removeIfExists(`venuePresence/${venueId}/${uid}`);
    }
  }

  try {
    await deleteObject(storageRef(storage, `avatars/${uid}.jpg`));
  } catch {
    // Avatar may not exist.
  }

  await Promise.all([
    removeIfExists(`profiles/${uid}`),
    removeIfExists(`users/${uid}`),
    removeIfExists(`userConversations/${uid}`),
    removeIfExists(`userNotes/${uid}`),
    removeIfExists(`userPresence/${uid}`),
    removeIfExists(`pushTokens/${uid}`),
    removeIfExists(`blockedUsers/${uid}`),
    removeIfExists(`peerInfo/${uid}`),
    removeIfExists(`userLocations/${uid}`),
    removeIfExists(`user_locations/${uid}`),
  ]);

  await AsyncStorage.multiRemove([
    'userProfile',
    'userHasProfile',
    'lastKnownLocation',
    'userPreferences',
    'dataConsentGiven',
    'hasSeenOnboarding',
    'ageConfirmed17',
    'ghostMode',
    'lastVenueId',
    'pushToken',
  ]);

  try {
    await deleteUser(user);
  } catch (error: any) {
    if (error?.code === 'auth/requires-recent-login') {
      throw new Error('For security, sign out and sign in again before deleting your account.');
    }
    throw error;
  }
}

export async function setGhostMode(enabled: boolean) {
  const user = auth.currentUser;
  if (!user) return;
  await update(ref(database, `profiles/${user.uid}`), {
    ghostMode: enabled,
    lastUpdated: new Date().toISOString(),
  });
  const presenceSnap = await get(ref(database, `userPresence/${user.uid}`));
  if (presenceSnap.exists()) {
    const venueId = presenceSnap.val()?.venueId;
    if (venueId) {
      await update(ref(database, `venuePresence/${venueId}/${user.uid}`), {
        ghost: enabled,
      });
    }
  }
}
