import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ExtraFirebase = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function fromExtra(): ExtraFirebase {
  const extra = Constants.expoConfig?.extra as { firebase?: ExtraFirebase } | undefined;
  return extra?.firebase ?? {};
}

function required(name: string, fallback?: string): string {
  const value = process.env[name]?.trim() || fallback?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in EAS env / .env — then fully restart Metro (not just reload).`);
  }
  return value;
}

const extra = fromExtra();

const firebaseConfig: FirebaseOptions = {
  apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY', extra.apiKey),
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ||
    extra.authDomain ||
    'auth.shytext.com',
  projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID', extra.projectId),
  storageBucket: required('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', extra.storageBucket),
  messagingSenderId: required('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', extra.messagingSenderId),
  appId: required('EXPO_PUBLIC_FIREBASE_APP_ID', extra.appId),
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
// Prefer the device language for Firebase Auth SMS / emails.
auth.useDeviceLanguage();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
