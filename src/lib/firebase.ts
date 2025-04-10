import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration from the console
const firebaseConfig = {
  apiKey: "AIzaSyAVnkBhxkzWdh2fLXsBMRDcRGYbY2KnBeE",
  authDomain: "myshytext.firebaseapp.com",
  projectId: "myshytext",
  storageBucket: "myshytext.appspot.com",
  messagingSenderId: "680911194317",
  appId: "1:680911194317:web:b5c93b3d272d9e727cc184",
  databaseURL: "https://myshytext-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize and export Realtime Database with error handling
export const database = getDatabase(app);

// Log database initialization
console.log("Firebase Realtime Database initialized:", database.app.options.databaseURL);

// Cache the auth state for persistence
export const cacheAuthState = async (user: any) => {
  if (user) {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem('user');
  }
};

// Check for cached auth state
export const getCachedAuthState = async () => {
  const userData = await AsyncStorage.getItem('user');
  return userData ? JSON.parse(userData) : null;
};

// Google Auth utility
export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

export default app; 