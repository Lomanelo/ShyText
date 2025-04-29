import { initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, get, set } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { Alert, Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration
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

// Directly requiring the React Native specific modules to bypass TypeScript errors
const { initializeAuth } = require('firebase/auth');
const getReactNativePersistence = require('firebase/auth').getReactNativePersistence;

// Initialize Auth using the direct require, bypassing TypeScript checking
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize other Firebase services
export const database = getDatabase(app);
export const storage = getStorage(app);

// Log database initialization
console.log("Firebase Realtime Database initialized:", database.app.options.databaseURL);
console.log("Firebase Storage initialized with bucket:", app.options.storageBucket);

// Check if user profile exists and is complete
export const checkUserProfileExists = async (userId: string) => {
  try {
    const userProfileRef = ref(database, 'profiles/' + userId);
    const snapshot = await get(userProfileRef);
    
    if (snapshot.exists()) {
      const profileData = snapshot.val();
      // Check if profile has essential fields
      return !!profileData && !!profileData.firstName;
    }
    return false;
  } catch (error) {
    console.error('Error checking user profile:', error);
    return false;
  }
};

// Google Auth utility
export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

export default app; 