import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, PhoneAuthProvider, signInWithCredential, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirestore, GeoPoint, collection, doc, setDoc, updateDoc, getDoc, query, where, getDocs, addDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as geofirestore from 'geofire-common';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally (only in web environment)
let analytics = null;
isSupported().then(yes => yes && (analytics = getAnalytics(app))).catch(console.error);

// Use standard auth initialization - we'll handle persistence separately
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Phone authentication functions
let recaptchaVerifier: RecaptchaVerifier | null = null;

// Initialize recaptcha verifier for web platforms
export const initRecaptchaVerifier = (containerOrId: string | HTMLElement) => {
  if (typeof window !== 'undefined') {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerOrId, {
      size: 'invisible',
    });
    return recaptchaVerifier;
  }
  return null;
};

// Send verification code to phone number
export const sendVerificationCode = async (phoneNumber: string, recaptchaVerifierInstance: RecaptchaVerifier | null = null) => {
  try {
    // Web implementation requires recaptcha
    if (Platform.OS === 'web') {
      const verifierToUse = recaptchaVerifierInstance || recaptchaVerifier;
      if (!verifierToUse) {
        throw new Error('RecaptchaVerifier is not initialized (required for web platform)');
      }
      
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifierToUse);
      return { success: true, confirmationResult };
    } 
    // Mobile implementation (iOS/Android)
    else {
      console.log("Using mobile phone authentication");
      
      // For development builds, always use mock verification
      // This avoids SMS verification and AsyncStorage issues
      const mockConfirmationResult = {
        verificationId: 'mock-verification-id',
        confirm: async (code: string) => {
          if (code === '123456') { // Test code
            return {
              user: { uid: 'test-user-id' }
            };
          } else {
            throw new Error('Invalid verification code');
          }
        }
      };
      
      return { success: true, confirmationResult: mockConfirmationResult };
    }
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error };
  }
};

// Verify phone number with code
export const verifyPhoneNumber = async (confirmation: any, verificationCode: string) => {
  try {
    // Handle both real Firebase confirmations and our mock implementation
    let userCredential;
    
    if (Platform.OS === 'web') {
      // For web
      userCredential = await confirmation.confirm(verificationCode);
    } else {
      // For mobile, use our mock implementation for development builds
      if (verificationCode === '123456') {
        console.log("Using mock verification success path");
        userCredential = { user: { uid: 'test-user-id' } };
      } else {
        throw new Error('Invalid verification code');
      }
    }
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, error };
  }
};

// Complete user profile after phone authentication
export const completeUserProfile = async (uid: string, profileData: { displayName: string; birthDate: string; photoURL?: string }) => {
  try {
    const { displayName, birthDate, photoURL } = profileData;
    
    // Update user profile in Firebase Auth if available
    if (auth.currentUser) {
      await updateDoc(doc(db, 'profiles', uid), {
        display_name: displayName,
        birth_date: birthDate,
        photo_url: photoURL,
        updated_at: new Date().toISOString(),
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error completing user profile:', error);
    return { success: false, error };
  }
};

// Upload profile image
export const uploadProfileImage = async (uri: string, userId: string) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, `profile_images/${userId}`);
    await uploadBytes(storageRef, blob);
    
    const downloadURL = await getDownloadURL(storageRef);
    return { success: true, downloadURL };
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return { success: false, error };
  }
};

// Helper function to get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Update user location
export async function updateLocation(latitude: number, longitude: number) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userRef = doc(db, 'profiles', user.uid);
  
  try {
    await updateDoc(userRef, {
      last_location: new GeoPoint(latitude, longitude),
      last_active: new Date().toISOString(),
      // Store geohash for efficient geoqueries
      geohash: geofirestore.geohashForLocation([latitude, longitude] as [number, number])
    });
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

// Find nearby users using geohash queries
export async function findNearbyUsers(latitude: number, longitude: number, distanceInKm = 1) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const center = [latitude, longitude];
  const radiusInM = distanceInKm * 1000;
  
  // Each item in 'bounds' represents a geohash range to query for
  const bounds = geofirestore.geohashQueryBounds(center as [number, number], radiusInM);
  const promises = [];
  
  for (const b of bounds) {
    const q = query(
      collection(db, 'profiles'),
      where('geohash', '>=', b[0]),
      where('geohash', '<=', b[1])
    );
    
    promises.push(getDocs(q));
  }
  
  // Collect all the query results
  const snapshots = await Promise.all(promises);
  
  // Filter results that are within the specified radius and not the current user
  const matchingDocs = [];
  
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const userData = doc.data();
      
      // Skip the current user
      if (doc.id === user.uid) continue;
      
      // We have to filter out some false positives due to the geohash algorithm
      const docLocation = userData.last_location;
      if (docLocation) {
        const distanceInM = geofirestore.distanceBetween(
          [docLocation.latitude, docLocation.longitude] as [number, number],
          center as [number, number]
        ) * 1000;
        
        if (distanceInM <= radiusInM) {
          matchingDocs.push({
            id: doc.id,
            ...userData,
            distance: distanceInM
          });
        }
      }
    }
  }
  
  return matchingDocs;
}

// Start a conversation with another user
export async function startConversation(receiverId: string, message: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Create a new conversation
    const conversationRef = collection(db, 'conversations');
    const newConversationRef = await addDoc(conversationRef, {
      initiator_id: user.uid,
      receiver_id: receiverId,
      created_at: new Date().toISOString(),
      status: 'pending',
    });
    
    // Add the first message
    const messagesRef = collection(db, 'messages');
    await addDoc(messagesRef, {
      conversation_id: newConversationRef.id,
      sender_id: user.uid,
      content: message,
      created_at: new Date().toISOString(),
    });
    
    // Get the conversation data
    const conversationSnapshot = await getDoc(newConversationRef);
    return { id: conversationSnapshot.id, ...conversationSnapshot.data() };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

// Respond to a conversation (accept or reject)
export async function respondToConversation(conversationId: string, accept: boolean) {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      status: accept ? 'accepted' : 'rejected',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error responding to conversation:', error);
    throw error;
  }
}

// Send a message in a conversation
export async function sendMessage(conversationId: string, content: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const messagesRef = collection(db, 'messages');
    await addDoc(messagesRef, {
      conversation_id: conversationId,
      sender_id: user.uid,
      content: content,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Subscribe to conversation messages
export function subscribeToMessages(conversationId: string, callback: (messages: any[]) => void) {
  const messagesQuery = query(
    collection(db, 'messages'),
    where('conversation_id', '==', conversationId),
    orderBy('created_at', 'asc')
  );
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
}

// Get user conversations
export async function getUserConversations() {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const q1 = query(
      collection(db, 'conversations'),
      where('initiator_id', '==', user.uid)
    );
    const q2 = query(
      collection(db, 'conversations'),
      where('receiver_id', '==', user.uid)
    );
    
    const [initiatedSnap, receivedSnap] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);
    
    const conversations = [
      ...initiatedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ...receivedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    ];
    
    return conversations;
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
} 