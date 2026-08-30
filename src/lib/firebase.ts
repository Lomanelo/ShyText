import { getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, get } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const firebaseConfig = {
  apiKey: 'AIzaSyAVnkBhxkzWdh2fLXsBMRDcRGYbY2KnBeE',
  authDomain: 'myshytext.firebaseapp.com',
  projectId: 'myshytext',
  storageBucket: 'myshytext.appspot.com',
  messagingSenderId: '680911194317',
  appId: '1:680911194317:web:b5c93b3d272d9e727cc184',
  databaseURL: 'https://myshytext-default-rtdb.firebaseio.com',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch {
    // Fast Refresh can re-run this file after Auth is already created.
  }

  return getAuth(app);
}

export const auth = createAuth();

export const database = getDatabase(app);
export const storage = getStorage(app);

export const checkUserProfileExists = async (userId: string) => {
  try {
    const snapshot = await get(ref(database, 'profiles/' + userId));
    if (snapshot.exists()) {
      const profileData = snapshot.val();
      return !!profileData && !!profileData.firstName;
    }
    return false;
  } catch (error) {
    console.error('Error checking user profile:', error);
    return false;
  }
};

export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

export const signInWithAppleCredential = async (identityToken: string, nonce: string) => {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: identityToken,
    rawNonce: nonce,
  });
  return await signInWithCredential(auth, credential);
};

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export const uploadProfileImage = async (userId: string, uri: string): Promise<string | null> => {
  try {
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const blob = await uriToBlob(processed.uri);
    const imageRef = storageRef(storage, `avatars/${userId}.jpg`);
    await uploadBytes(imageRef, blob);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return null;
  }
};

export default app;
