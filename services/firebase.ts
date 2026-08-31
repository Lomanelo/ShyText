import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAVnkBhxkzWdh2fLXsBMRDcRGYbY2KnBeE',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'myshytext.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'myshytext',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'myshytext.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '680911194317',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:680911194317:web:b5c93b3d272d9e727cc184',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    const authMod = require('firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => object;
    };
    if (typeof authMod.getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: authMod.getReactNativePersistence(AsyncStorage) as never,
      });
    }
  } catch {
    // Auth already initialized (Fast Refresh).
  }
  return getAuth(app);
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
