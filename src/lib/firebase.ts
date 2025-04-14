import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, StorageReference, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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

// Initialize and export Firebase Storage with error handling
let storage: ReturnType<typeof getStorage> | undefined;
try {
  if (firebaseConfig.storageBucket) {
    storage = getStorage(app);
    console.log("Firebase Storage initialized with bucket:", app.options.storageBucket);
  } else {
    console.warn("No storage bucket specified in Firebase config");
  }
} catch (error) {
  console.error("Error initializing Firebase Storage:", error);
}
export { storage };

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

// Check if user profile exists and is complete
export const checkUserProfileExists = async (userId: string) => {
  try {
    const { ref, get } = require('firebase/database');
    const userProfileRef = ref(database, 'profiles/' + userId);
    const snapshot = await get(userProfileRef);
    
    if (snapshot.exists()) {
      const profileData = snapshot.val();
      // Check if profile has essential fields (consider a profile complete if it has firstName)
      return !!profileData && !!profileData.firstName;
    }
    return false;
  } catch (error) {
    console.error('Error checking user profile:', error);
    return false;
  }
};

// Utility to save a profile image to Firebase Storage
export const uploadProfileImage = async (userId: string, localUri: string): Promise<string | null> => {
  if (!storage) {
    console.warn("Firebase Storage not available, can't upload profile image");
    return localUri; // Return the local URI as a fallback
  }
  
  try {
    // Convert to blob
    const response = await fetch(localUri);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    const imageRef = storageRef(storage, `profileImages/${userId}`);
    await uploadBytes(imageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
    console.log('Image uploaded successfully, URL:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return localUri; // Return the local URI as a fallback
  }
};

// Google Auth utility
export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

export default app; 