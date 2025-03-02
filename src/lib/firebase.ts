import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
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

// Email and password authentication functions

// Register new user with email and password
export const registerWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create initial user profile
    await setDoc(doc(db, 'profiles', userCredential.user.uid), {
      email: email,
      created_at: new Date().toISOString(),
      display_name: '',
      birth_date: '',
      photo_url: '',
      onboarding_completed: false
    });
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error registering with email:', error);
    return { success: false, error };
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error signing in with email:', error);
    return { success: false, error };
  }
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
export const isValidPassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
  }
  
  // Add more password requirements as needed
  return { isValid: true, message: '' };
};

// Complete user profile after authentication
export const completeUserProfile = async (uid: string, profileData: { displayName: string; birthDate: string; photoURL?: string }) => {
  try {
    const { displayName, birthDate, photoURL } = profileData;
    
    console.log("Completing profile for user:", uid);
    
    // First check if the profile document exists
    const profileRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      // Update existing profile
      await updateDoc(profileRef, {
        display_name: displayName,
        birth_date: birthDate,
        photo_url: photoURL || '',
        updated_at: new Date().toISOString(),
      });
    } else {
      // Create new profile document if it doesn't exist
      await setDoc(profileRef, {
        display_name: displayName,
        birth_date: birthDate,
        photo_url: photoURL || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_completed: false,
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
      status: 'pending', // pending, accepted, declined
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    // Add the first message
    const messagesRef = collection(db, 'conversations', newConversationRef.id, 'messages');
    await addDoc(messagesRef, {
      sender_id: user.uid,
      content: message,
      timestamp: new Date().toISOString(),
      read: false,
    });
    
    return { success: true, conversationId: newConversationRef.id };
  } catch (error) {
    console.error('Error starting conversation:', error);
    return { success: false, error };
  }
}

// Respond to a conversation request (accept or decline)
export async function respondToConversation(conversationId: string, accept: boolean) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      status: accept ? 'accepted' : 'declined',
      updated_at: new Date().toISOString(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error responding to conversation:', error);
    return { success: false, error };
  }
}

// Send a message in a conversation
export async function sendMessage(conversationId: string, content: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageDoc = await addDoc(messagesRef, {
      sender_id: user.uid,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    });
    
    // Update the conversation's last update timestamp
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      updated_at: new Date().toISOString(),
    });
    
    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error };
  }
}

// Subscribe to messages in a conversation
export function subscribeToMessages(conversationId: string, callback: (messages: any[]) => void) {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
}

// Get all conversations for the current user
export async function getUserConversations() {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Query conversations where the user is either the initiator or receiver
    const q1 = query(
      collection(db, 'conversations'),
      where('initiator_id', '==', user.uid)
    );
    
    const q2 = query(
      collection(db, 'conversations'),
      where('receiver_id', '==', user.uid)
    );
    
    const [initiatedSnapshots, receivedSnapshots] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);
    
    // Define type for conversation data
    type ConversationData = {
      id: string;
      initiator_id: string;
      receiver_id: string;
      status: string;
      created_at: string;
      updated_at: string;
      isInitiator: boolean;
      [key: string]: any; // For any additional fields
    };
    
    // Combine and format results
    const conversations: ConversationData[] = [
      ...initiatedSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: true
      })) as ConversationData[],
      ...receivedSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: false
      })) as ConversationData[]
    ];
    
    // Sort by updated_at (most recent first)
    conversations.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    
    return { success: true, conversations };
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return { success: false, error };
  }
} 