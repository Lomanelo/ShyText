import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, get, set } from 'firebase/database';
import { getStorage, StorageReference, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { Platform } from 'react-native';

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

// Utility to save a profile image to Firebase Database as base64
export const uploadProfileImage = async (userId: string, localUri: string): Promise<string | null> => {
  console.log(`Starting profile image upload for user ${userId}`);
  
  // If the uri is already a remote URL, return it directly
  if (localUri && (localUri.startsWith('https://') || localUri.startsWith('http://'))) {
    console.log('Image is already a remote URL, skipping upload');
    return localUri;
  }
  
  // Default fallback URL
  const defaultImageUrl = "https://firebasestorage.googleapis.com/v0/b/myshytext.appspot.com/o/defaults%2Fdefault_avatar.png?alt=media";
  
  try {
    // Validate URI format
    if (!localUri) {
      console.error('Image URI is null or undefined');
      Alert.alert('Upload Error', 'No image provided');
      return defaultImageUrl;
    }
    
    console.log(`Processing image...`);
    
    // Fetch and process the image
    try {
      // Fetch the image
      const response = await fetch(localUri);
      
      if (!response.ok) {
        console.error(`Fetch failed with status: ${response.status}`);
        Alert.alert('Upload Error', 'Could not access the image');
        return defaultImageUrl;
      }
      
      // Convert to blob
      const imageBlob = await response.blob();
      console.log(`Image processed: ${imageBlob.size} bytes`);
      
      if (!imageBlob || imageBlob.size === 0) {
        console.error('Invalid image data');
        Alert.alert('Upload Error', 'Image data is invalid');
        return defaultImageUrl;
      }
      
      if (imageBlob.size > 1024 * 1024) {
        console.warn(`Image is large (${imageBlob.size} bytes), this may cause performance issues`);
      }
      
      // Convert image to base64 string for database storage
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert image to base64'));
          }
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(imageBlob);
      const base64Image = await base64Promise;
      
      console.log(`Image converted to base64 (length: ${base64Image.length} chars)`);
      
      // Store in Realtime Database
      const userRef = ref(database, `profiles/${userId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        await set(userRef, {
          ...snapshot.val(),
          photoURL: base64Image,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await set(userRef, {
          photoURL: base64Image,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
      
      console.log('Profile image saved to database as base64');
      
      // The base64 data is now the source of truth, so return it as the URL
      return base64Image;
      
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Upload Error', 'Could not process the image');
      return defaultImageUrl;
    }
  } catch (error) {
    console.error('Critical error in uploadProfileImage:', error);
    Alert.alert('Upload Error', 'An unexpected error occurred');
    return defaultImageUrl;
  }
};

// Google Auth utility
export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

export default app; 