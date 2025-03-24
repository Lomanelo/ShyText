import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, updateProfile, initializeAuth, getReactNativePersistence, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getFirestore, GeoPoint, collection, doc, setDoc, updateDoc, getDoc, query, where, getDocs, addDoc, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import * as geofirestore from 'geofire-common';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendNewMessageNotification, sendChatAcceptedNotification, sendVerificationNotification } from '../utils/notifications';

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

// Initialize Firebase Auth with AsyncStorage persistence
export const auth = Platform.OS === 'web' 
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

export const db = getFirestore(app);
export const storage = getStorage(app);

// Temporary storage for registration flow data
let registrationData: {
  email: string;
  password: string;
  displayName: string;
  birthDate: string;
} | null = null;

// Store credentials for later registration
export const storeCredentials = (email: string, password: string) => {
  registrationData = {
    email,
    password,
    displayName: '',
    birthDate: ''
  };
  return { success: true };
};

// Update registration data during flow
export const updateRegistrationData = (data: { displayName?: string; birthDate?: string }) => {
  if (!registrationData) {
    return { success: false, error: 'No registration in progress' };
  }

  if (data.displayName !== undefined) {
    registrationData.displayName = data.displayName;
  }

  if (data.birthDate !== undefined) {
    registrationData.birthDate = data.birthDate;
  }

  return { success: true };
};

// Get registration data
export const getRegistrationData = () => {
  return registrationData;
};

// Complete registration after collecting all data
export const completeRegistration = async (photoURL?: string) => {
  try {
    console.log('Starting complete registration...');
    
    // Get the stored registration data
    const registrationData = getRegistrationData();
    if (!registrationData || !registrationData.email || !registrationData.password) {
      console.error('Missing registration data:', registrationData);
      return { success: false, error: 'Missing registration data' };
    }
    
    const { email, password, displayName, birthDate } = registrationData;
    
    // Get device UUID before creating the account
    let deviceUUID = '';
    try {
      // Import dynamically to avoid issues with circular imports
      const { getDeviceUUID } = require('../utils/deviceUtils');
      deviceUUID = await getDeviceUUID();
      console.log('Device UUID for registration:', deviceUUID);
    } catch (error) {
      console.warn('Could not get device UUID:', error);
      // Continue with registration even if we can't get the UUID
      // We'll attempt to get it later
    }
    
    console.log('Creating Firebase auth account...');
    // Create Firebase authentication account
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    console.log(`User created with ID: ${user.uid}`);
    
    // Create Firestore profile including device UUID
    const profileData = {
      email,
      display_name: displayName || '',
      birth_date: birthDate || '',
      photo_url: '',
      device_uuid: deviceUUID,  // Store the device UUID
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      location: null
    };
    
    console.log('Creating user profile in Firestore...');
    await setDoc(doc(db, 'profiles', user.uid), profileData);
    console.log('Firestore profile created successfully');
    
    // Also store device UUID in a separate collection for better querying
    if (deviceUUID) {
      await setDoc(doc(db, 'user_devices', user.uid), {
        device_uuid: deviceUUID,
        last_updated: new Date().toISOString()
      });
      console.log('Device UUID stored in user_devices collection');
    }
    
    // Clear registration data
    clearRegistrationData();
    
    return { success: true, user };
  } catch (error) {
    console.error('Error during registration completion:', error);
    return { success: false, error };
  }
};

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
    throw error;
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
    
    // Validate and format the birthDate
    let validBirthDate = birthDate;
    
    try {
      // Ensure the birthDate is a valid date by creating a Date object and
      // confirming it's not an "Invalid Date"
      const dateObj = new Date(birthDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Convert to ISO string format and keep just the date part (YYYY-MM-DD)
      validBirthDate = dateObj.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error validating birth date:', error);
      return { success: false, error: 'Invalid birth date format' };
    }
    
    console.log("Completing profile for user:", uid);
    
    // First check if the profile document exists
    const profileRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      // Update existing profile
      await updateDoc(profileRef, {
        display_name: displayName,
        birth_date: validBirthDate,
        photo_url: photoURL || '',
        updated_at: new Date().toISOString(),
      });
    } else {
      // Create new profile document if it doesn't exist
      await setDoc(profileRef, {
        display_name: displayName,
        birth_date: validBirthDate,
        photo_url: photoURL || '',
        created_at: new Date().toISOString(),
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
    console.log(`Starting upload for image at: ${uri}`);
    
    // Validate the URI
    if (!uri || typeof uri !== 'string') {
      console.error('Invalid image URI format:', uri);
      return { success: false, error: 'Invalid image URI format' };
    }
    
    // Check if user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.error('User not authenticated for upload');
      return { success: false, error: 'User not authenticated' };
    }
    
    // Verify that the userId matches the current user's ID
    if (currentUser.uid !== userId) {
      console.error(`User ID mismatch: current=${currentUser.uid}, requested=${userId}`);
      return { success: false, error: 'User ID mismatch' };
    }
    
    try {
      // Try to use Firebase Storage with a properly configured path
      const timestamp = new Date().getTime();
      const filename = `profile_${userId}_${timestamp}.jpg`;
      const storageRef = ref(storage, `profile_images/${filename}`);
      
      // Fetch the image and prepare for upload
      console.log('Fetching image data...');
      const response = await fetch(uri);
      const blob = await response.blob();
      console.log(`Image blob size: ${blob.size} bytes`);
      
      // File size limit check completely removed - allowing uploads of any size
      
      // Upload to Firebase Storage
      console.log('Uploading to Firebase Storage...');
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      // Wait for the upload to complete
      console.log('Waiting for upload to complete...');
      await uploadTask;
      
      // Get the download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(storageRef);
      console.log(`Download URL: ${downloadURL}`);
      
      // Update the user's photoURL in Authentication
      await updateProfile(currentUser, {
        photoURL: downloadURL
      });
      console.log('User authentication profile updated with new photo URL');
      
      // Update user profile with the download URL
      const profileRef = doc(db, 'profiles', userId);
      await updateDoc(profileRef, {
        photo_url: downloadURL,
        updated_at: new Date().toISOString()
      });
      
      return { success: true, downloadURL };
    } catch (error) {
      console.error('Error during image upload:', error);
      // Check if the error is related to size limits from Firebase
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        return { 
          success: false, 
          error: 'The image exceeds Firebase Storage quota limits. Please use a smaller image (under 10MB).' 
        };
      }
      return { success: false, error: 'Failed to upload image. Please try again.' };
    }
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
export async function updateLocation(
  latitude: number, 
  longitude: number, 
  motionData?: {
    heading?: number;
    speed?: number;
    activity?: string;
    movementIntensity?: number;
  }
) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userRef = doc(db, 'profiles', user.uid);
  
  try {
    const updateData: any = {
      last_location: new GeoPoint(latitude, longitude),
      last_active: new Date().toISOString(),
      // Store geohash for efficient geoqueries
      geohash: geofirestore.geohashForLocation([latitude, longitude] as [number, number])
    };
    
    // Add motion data if available
    if (motionData) {
      if (motionData.heading !== undefined) {
        updateData.last_heading = motionData.heading;
      }
      
      if (motionData.speed !== undefined) {
        updateData.last_speed = motionData.speed;
      }
      
      if (motionData.activity) {
        updateData.last_activity = motionData.activity;
      }
      
      if (motionData.movementIntensity !== undefined) {
        updateData.movement_intensity = motionData.movementIntensity;
      }
    }
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

// Find nearby users using geohash queries
export async function findNearbyUsers(latitude: number, longitude: number, distanceInKm = 0.01, includeCloseUsers = true) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Ensure we're using a minimum search radius to account for GPS inaccuracy
  // If phones are physically next to each other, they still need to find each other
  const minimumRadiusInKm = 0.015; // 15 meters minimum search radius
  const effectiveDistanceInKm = Math.max(distanceInKm, minimumRadiusInKm);
  
  const center = [latitude, longitude];
  const radiusInM = effectiveDistanceInKm * 1000;
  
  try {
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
        
        // If the user doesn't have location data, skip them
        const docLocation = userData.last_location;
        if (!docLocation || !docLocation.latitude || !docLocation.longitude) continue;
        
        // Calculate the actual distance
        const distanceInM = geofirestore.distanceBetween(
          [docLocation.latitude, docLocation.longitude] as [number, number],
          center as [number, number]
        ) * 1000;
        
        // For very close users (within 20 meters), add a flag to indicate they're nearby
        const isVeryClose = distanceInM <= 20;
        
        // Determine if we should include this user
        // Either they're within the requested radius OR
        // they're very close and we've been asked to include close users
        if (distanceInM <= radiusInM || (isVeryClose && includeCloseUsers)) {
          // Clean up the photo URL to ensure it's valid
          let photoUrl = userData.photo_url || '';
          
          // Add additional info
          const userWithDistance = {
            id: doc.id,
            distance: Math.round(distanceInM), // Round to nearest meter for UI display
            isVeryClose: isVeryClose, // Add flag for UI highlighting if needed
            ...userData
          };
          
          matchingDocs.push(userWithDistance);
        }
      }
    }
    
    // Sort by distance (closest first)
    return matchingDocs.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error finding nearby users:', error);
    return [];
  }
}

// Start a conversation with another user
export async function startConversation(receiverId: string, message: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Check if there's already a conversation between these users
    const existingConvQuery = query(
      collection(db, 'conversations'),
      where('initiator_id', 'in', [user.uid, receiverId]),
      where('receiver_id', 'in', [user.uid, receiverId])
    );
    
    const existingConvSnapshot = await getDocs(existingConvQuery);
    
    // If there's an existing conversation, check its status
    if (!existingConvSnapshot.empty) {
      const existingConvDoc = existingConvSnapshot.docs[0];
      const existingConv = existingConvDoc.data();
      const existingConvId = existingConvDoc.id;
      
      // Check who initiated the existing conversation
      const userIsInitiator = existingConv.initiator_id === user.uid;
      
      // If the conversation exists but is in an invalid state (corrupt data, etc.)
      // or it's extremely old, recreate it
      try {
        // If the conversation is very old (>30 days), we can create a new one
        const updatedAt = existingConv.updated_at ? new Date(existingConv.updated_at) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (updatedAt && updatedAt < thirtyDaysAgo) {
          // Delete the old conversation and create a new one
          console.log("Conversation is over 30 days old, creating a new one");
          await deleteDoc(doc(db, 'conversations', existingConvId));
          throw new Error("Creating new conversation"); // This will skip to the creation code
        }
      } catch (error) {
        // If we got here due to our own throw, continue to create a new conversation
        if (error instanceof Error && error.message === "Creating new conversation") {
          // Continue to the conversation creation code
          console.log("Proceeding to create a new conversation");
        } else {
          // For any other errors, throw normally
          throw error;
        }
      }
      
      if (existingConv.status === 'declined' && userIsInitiator) {
        throw new Error('This user has declined your previous conversation request');
      }
      
      if (existingConv.status === 'pending') {
        // If the user is the initiator, they should be redirected to the existing chat
        if (userIsInitiator) {
          return { success: true, conversationId: existingConvId };
        }
        // If they're the receiver, tell them they already have a request from this user
        else {
          throw new Error('This user has already sent you a conversation request');
        }
      }
      
      if (existingConv.status === 'accepted') {
        return { success: true, conversationId: existingConvId };
      }
    }
    
    // Get sender profile info
    const senderProfile = await getProfile(user.uid);
    
    // Create a new conversation
    const conversationRef = collection(db, 'conversations');
    const newConversationRef = await addDoc(conversationRef, {
      initiator_id: user.uid,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages_count: 1, // Important for security rules
      last_message: message,
      last_message_time: new Date().toISOString(),
    });
    
    // Add the first message
    const messagesRef = collection(db, 'conversations', newConversationRef.id, 'messages');
    await addDoc(messagesRef, {
      sender_id: user.uid,
      content: message,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'initial', // Mark this as the initial message
    });
    
    // Send notification to receiver if they have a push token
    const receiverProfile = await getProfile(receiverId);
    if (receiverProfile && receiverProfile.push_token) {
      try {
        // Send a push notification for the message
        await sendNewMessageNotification(
          senderProfile?.display_name || 'Someone',
          message,
          newConversationRef.id,
          user.uid,
          receiverId
        );
        
        console.log('Chat notification sent successfully');
      } catch (notifError) {
        console.error('Error sending chat notification:', notifError);
        // Continue even if notification fails
      }
    }
    
    return { success: true, conversationId: newConversationRef.id };
  } catch (error) {
    console.error('Error starting conversation:', error);
    throw error;
  }
}

// Respond to a conversation request (accept or decline)
export async function respondToConversation(conversationId: string, accept: boolean) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Get the conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationSnap.data();
    
    // Check if the current user is the receiver
    if (conversationData.receiver_id !== user.uid) {
      throw new Error('Not authorized to respond to this conversation');
    }
    
    // Verify the conversation is pending
    if (conversationData.status !== 'pending') {
      throw new Error('This conversation is no longer pending');
    }
    
    // Update the conversation status
    await updateDoc(conversationRef, {
      status: accept ? 'accepted' : 'declined',
      updated_at: new Date().toISOString()
    });
    
    // If accepted, add a system message
    if (accept) {
      // Get user profile
      const userProfile = await getProfile(user.uid);
      
      // Add system message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, {
        sender_id: 'system',
        content: `${userProfile?.display_name || 'User'} accepted the conversation`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'system',
      });
      
      // Send notification to the initiator
      try {
        // Get initiator profile
        const initiatorProfile = await getProfile(conversationData.initiator_id);
        
        if (initiatorProfile && initiatorProfile.push_token) {
          // Send notification of acceptance
          await sendChatAcceptedNotification(
            userProfile?.display_name || 'Someone',
            conversationId,
            conversationData.initiator_id
          );
          
          console.log('Chat acceptance notification sent successfully');
        }
      } catch (notifError) {
        console.error('Error sending chat acceptance notification:', notifError);
        // Continue even if notification fails
      }
    }
    
    return { success: true };
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
    // Get conversation data first
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationSnap.data();
    
    // Check if user is part of the conversation
    if (conversationData.initiator_id !== user.uid && conversationData.receiver_id !== user.uid) {
      throw new Error('Not authorized to send messages in this conversation');
    }
    
    // Check conversation status
    if (conversationData.status === 'declined') {
      throw new Error('Cannot send messages in a declined conversation');
    }
    
    if (conversationData.status === 'pending' && conversationData.initiator_id !== user.uid) {
      throw new Error('Cannot send messages in a pending conversation');
    }
    
    // Get sender profile
    const senderProfile = await getProfile(user.uid);
    
    // Add the message
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageDoc = await addDoc(messagesRef, {
      sender_id: user.uid,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'message',
    });
    
    // Update conversation metadata
    await updateDoc(conversationRef, {
      last_message: content,
      last_message_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages_count: (conversationData.messages_count || 0) + 1,
    });
    
    // Determine the receiver ID (the other user in the conversation)
    const receiverId = conversationData.initiator_id === user.uid 
      ? conversationData.receiver_id 
      : conversationData.initiator_id;
    
    // Send notification to receiver if they have a push token
    const receiverProfile = await getProfile(receiverId);
    if (receiverProfile && receiverProfile.push_token) {
      try {
        // Send a push notification for the message
        await sendNewMessageNotification(
          senderProfile?.display_name || 'Someone',
          content,
          conversationId,
          user.uid,
          receiverId
        );
        
        console.log('Chat notification sent successfully');
      } catch (notifError) {
        console.error('Error sending chat notification:', notifError);
        // Continue even if notification fails
      }
    }
    
    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Subscribe to messages in a conversation
export function subscribeToMessages(conversationId: string, callback: (messages: any[]) => void) {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  
  // Add limit to initial query to load faster, and order by timestamp descending to get newest messages first
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(30));
  
  // Use a local cache to prevent unnecessary redraws
  let previousMessages: any[] = [];
  
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty && previousMessages.length === 0) {
      // No messages to display
      callback([]);
      return;
    }
    
    // Get new messages
    const newMessages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Reverse to get chronological order again
    newMessages.reverse();
    
    // Check if anything changed before triggering a re-render
    const messagesChanged = previousMessages.length !== newMessages.length || 
      JSON.stringify(newMessages.map(m => m.id)) !== JSON.stringify(previousMessages.map(m => m.id));
    
    if (messagesChanged) {
      previousMessages = [...newMessages];
      callback(newMessages);
    }
  }, 
  // Error handling callback
  (error) => {
    console.error('Error subscribing to messages:', error);
    // Still return empty array to prevent UI from hanging
    callback([]);
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
      where('initiator_id', '==', user.uid),
      orderBy('updated_at', 'desc')
    );
    
    const q2 = query(
      collection(db, 'conversations'),
      where('receiver_id', '==', user.uid),
      orderBy('updated_at', 'desc')
    );
    
    const [initiatedSnapshots, receivedSnapshots] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);
    
    // Combine and format results
    const conversations = [];
    
    // Process initiated conversations
    for (const doc of initiatedSnapshots.docs) {
      const data = doc.data();
      // Get the other user's profile
      const otherUserProfile = await getProfile(data.receiver_id);
      conversations.push({
        id: doc.id,
        ...data,
        isInitiator: true,
        otherUser: otherUserProfile,
      });
    }
    
    // Process received conversations
    for (const doc of receivedSnapshots.docs) {
      const data = doc.data();
      // Get the other user's profile
      const otherUserProfile = await getProfile(data.initiator_id);
      conversations.push({
        id: doc.id,
        ...data,
        isInitiator: false,
        otherUser: otherUserProfile,
      });
    }
    
    // Sort by updated_at (most recent first)
    conversations.sort((a: any, b: any) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return timeB - timeA;
    });
    
    return { success: true, conversations };
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
}

// Get user profile data
export async function getProfile(userId: string) {
  try {
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      return profileSnap.data();
    } else {
      console.warn('No profile found for user:', userId);
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Clear registration data
export const clearRegistrationData = () => {
  registrationData = null;
};

// Get the first message of a conversation
export async function getFirstMessage(conversationId: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Get the conversation to make sure the user is authorized
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationSnap.data();
    
    // Check if user is part of the conversation
    if (conversationData.initiator_id !== user.uid && conversationData.receiver_id !== user.uid) {
      throw new Error('Not authorized to view this conversation');
    }
    
    // Query the first message - sort by timestamp to get the oldest one
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(1));
    const messageSnapshot = await getDocs(q);
    
    if (messageSnapshot.empty) {
      return { success: false, message: null };
    }
    
    const firstMessage = {
      id: messageSnapshot.docs[0].id,
      ...messageSnapshot.docs[0].data()
    };
    
    return { success: true, message: firstMessage };
  } catch (error) {
    console.error('Error getting first message:', error);
    throw error;
  }
}

// Get a single conversation by ID
export async function getConversation(conversationId: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationSnap.data();
    
    // Check if user is part of the conversation
    if (conversationData.initiator_id !== user.uid && conversationData.receiver_id !== user.uid) {
      throw new Error('Not authorized to view this conversation');
    }
    
    // Determine the other user ID
    const otherUserId = conversationData.initiator_id === user.uid 
      ? conversationData.receiver_id 
      : conversationData.initiator_id;
    
    const isInitiator = conversationData.initiator_id === user.uid;
    
    return { 
      success: true, 
      conversation: {
        ...conversationData,
        id: conversationId,
        otherUserId,
        isInitiator
      } 
    };
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
}

// Update user's push notification token
export async function updatePushToken(userId: string, token: string) {
  try {
    const userRef = doc(db, 'users', userId);
    
    // First check if the user document exists
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // If the user document doesn't exist, try the profile collection
      const profileRef = doc(db, 'profiles', userId);
      await updateDoc(profileRef, {
        push_token: token,
        token_updated_at: new Date().toISOString()
      });
    } else {
      // Update the user document
      await updateDoc(userRef, {
        push_token: token,
        token_updated_at: new Date().toISOString()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating push token:', error);
    // Don't throw the error, just return failure
    return { success: false, error };
  }
}

// Submit a support message to Firebase
export async function submitSupportMessage(message: {
  subject: string;
  message: string;
  contactEmail: string;
  userId?: string;
  userName?: string;
  deviceInfo?: any;
}) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser && !message.userId) {
      throw new Error('User not authenticated');
    }
    
    // Get device information
    let deviceInfo = message.deviceInfo || {};
    try {
      const platform = Platform.OS;
      const version = Platform.Version;
      deviceInfo = {
        ...deviceInfo,
        platform,
        version,
        appVersion: '1.0.0', // Replace with actual app version
      };
    } catch (error) {
      console.warn('Could not get device info:', error);
    }
    
    // Create the support message document
    const supportData = {
      subject: message.subject || 'Support Request',
      message: message.message,
      contactEmail: message.contactEmail,
      userId: message.userId || currentUser?.uid,
      userName: message.userName || currentUser?.displayName || 'Unknown',
      deviceInfo: JSON.stringify(deviceInfo),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to support_messages collection
    await addDoc(collection(db, 'support_messages'), supportData);
    
    return { success: true };
  } catch (error) {
    console.error('Error submitting support message:', error);
    return { success: false, error };
  }
}

// Add this function after the getProfile function

export async function listAllUsers() {
  try {
    // Get all profiles from Firestore
    const profilesRef = collection(db, 'profiles');
    const profilesSnapshot = await getDocs(profilesRef);
    
    // Convert to array of user objects
    const users = profilesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username || '',
        display_name: data.display_name || '',
        photo_url: data.photo_url || '',
        status: data.status || 'Available',
        last_active: data.last_active || new Date().toISOString()
      };
    });
    
    return users;
  } catch (error) {
    console.error('Error listing all users:', error);
    return [];
  }
}

// Get user by device UUID
export const getUserByDeviceUUID = async (deviceUUID: string) => {
  try {
    // Try profiles directly first - this is the simplest approach
    const profilesRef = collection(db, 'profiles');
    const profileQuery = query(profilesRef, where('device_uuid', '==', deviceUUID));
    const profileSnapshot = await getDocs(profileQuery);
    
    if (!profileSnapshot.empty) {
      const profileDoc = profileSnapshot.docs[0];
      return { 
        id: profileDoc.id, 
        ...profileDoc.data(),
        device_uuid: deviceUUID
      };
    }
    
    // If not found in profiles, check devices collection
    const devicesRef = collection(db, 'devices');
    const deviceQuery = query(devicesRef, where('device_uuid', '==', deviceUUID));
    const deviceSnapshot = await getDocs(deviceQuery);
    
    if (!deviceSnapshot.empty) {
      const deviceDoc = deviceSnapshot.docs[0];
      const userId = deviceDoc.data().user_id;
      
      // Get the user profile with this ID
      const userDoc = await getDoc(doc(db, 'profiles', userId));
      if (userDoc.exists()) {
        return {
          id: userDoc.id,
          ...userDoc.data(),
          device_uuid: deviceUUID
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user by device UUID:', error);
    return null;
  }
};

// Store a discovered device ID for a user - used to verify users automatically
export const storeDiscoveredDeviceId = async (userId: string, deviceId: string) => {
  try {
    if (!userId || !deviceId) {
      console.error('Missing userId or deviceId for storing discovered device');
      return { success: false, error: 'Missing userId or deviceId' };
    }

    console.log(`Storing discovered device ID ${deviceId} for user ${userId}`);
    const timestamp = new Date().toISOString();
    let verificationSuccess = false;
    
    // Update the user's profile with the discovered device ID
    try {
      // First check if the profile document exists
      const profileRef = doc(db, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        // Update existing profile
        console.log(`Updating existing profile for user ${userId}`);
        await updateDoc(profileRef, {
          discovered_device_id: deviceId,
          mac_address: deviceId,
          is_verified: true,
          verified_at: timestamp,
          updated_at: timestamp
        });
        verificationSuccess = true;
      } else {
        // Profile doesn't exist, create a new one
        console.log(`Creating new profile for user ${userId}`);
        await setDoc(profileRef, {
          id: userId,
          discovered_device_id: deviceId,
          mac_address: deviceId,
          is_verified: true,
          verified_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp
        });
        verificationSuccess = true;
      }
      
      // Also update or create in users collection for redundancy
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          mac_address: deviceId,
          is_verified: true,
          verified_at: timestamp,
          updatedAt: timestamp
        });
        verificationSuccess = true;
      } else {
        await setDoc(userRef, {
          mac_address: deviceId,
          is_verified: true,
          verified_at: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        verificationSuccess = true;
      }
      
      // Send verification notification if verification was successful
      if (verificationSuccess) {
        try {
          // Send verification notification
          await sendVerificationNotification(userId);
          console.log(`Verification notification sent to user ${userId}`);
        } catch (notifError) {
          console.error('Error sending verification notification:', notifError);
          // Continue even if notification fails
        }
      }
      
      console.log(`Successfully stored discovered device ID for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error storing discovered device ID:', error);
      return { success: false, error };
    }
  } catch (error) {
    console.error('Error in storeDiscoveredDeviceId:', error);
    return { success: false, error };
  }
};

// Get user by username (which matches device name in our new approach)
export const getUserByUsername = async (username: string) => {
  try {
    const profilesRef = collection(db, 'profiles');
    const q = query(profilesRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const profileDoc = querySnapshot.docs[0];
      return { 
        id: profileDoc.id, 
        ...profileDoc.data() 
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
};

// Authenticate by username 
export const authenticateByDeviceName = async (username: string) => {
  try {
    // Find user profile by username directly
    const profilesRef = collection(db, 'profiles');
    const q = query(profilesRef, where('username', '==', username.trim()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Try case-insensitive search if exact match fails
      const allProfilesQuery = query(profilesRef);
      const allProfiles = await getDocs(allProfilesQuery);
      
      const matchingDocs = allProfiles.docs.filter(doc => {
        const data = doc.data();
        return data.username && data.username.toLowerCase() === username.toLowerCase();
      });
      
      if (matchingDocs.length === 0) {
        console.log('No user found with this username');
        return { success: false, error: 'No user found with this username' };
      }
      
      const userDoc = matchingDocs[0];
      const userData = userDoc.data();
      
      return {
        success: true,
        userId: userDoc.id,
        username: userData.username
      };
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    return {
      success: true,
      userId: userDoc.id,
      username: userData.username
    };
  } catch (error) {
    console.error('Error in authenticateByUsername:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

// Improved function to verify a user by MAC address
export const verifyUserByMacAddress = async (userId: string, macAddress: string): Promise<boolean> => {
  try {
    if (!userId || !macAddress) {
      console.error('Missing userId or macAddress for verification');
      return false;
    }
    
    console.log(`Verifying user ${userId} with MAC address ${macAddress}`);
    
    const db = getFirestore();
    const timestamp = new Date().toISOString();
    let profileError: any = null;
    let verificationSuccess = false;
    
    // Update profile document
    try {
      const profileRef = doc(db, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        console.warn(`Profile document for user ${userId} not found`);
      } else {
        await updateDoc(profileRef, {
          mac_address: macAddress,
          is_verified: true,
          verified_at: timestamp,
          updated_at: timestamp
        });
        console.log(`Successfully verified user in profiles collection: ${userId}`);
        verificationSuccess = true;
      }
    } catch (error) {
      profileError = error;
      console.error('Error updating profiles collection:', error);
      // Continue trying users collection even if profiles update fails
    }
    
    // Update user document in users collection 
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
     
      if (!userSnap.exists()) {
        console.warn(`User document for ${userId} not found in users collection`);
        // Create the document if it doesn't exist
        await setDoc(userRef, {
          mac_address: macAddress,
          is_verified: true,
          verified_at: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        console.log(`Created and verified new user document in users collection: ${userId}`);
        verificationSuccess = true;
      } else {
        await updateDoc(userRef, {
          mac_address: macAddress,
          is_verified: true,
          verified_at: timestamp,
          updatedAt: timestamp
        });
        console.log(`Successfully verified user in users collection: ${userId}`);
        verificationSuccess = true;
      }
      
      // Send verification notification if verification was successful
      if (verificationSuccess) {
        try {
          // Send verification notification
          await sendVerificationNotification(userId);
          console.log(`Verification notification sent to user ${userId}`);
        } catch (notifError) {
          console.error('Error sending verification notification:', notifError);
          // Continue even if notification fails
        }
      }
      
      // At least one collection was updated successfully
      return true;
    } catch (userError) {
      console.error('Error updating users collection:', userError);
      
      // If verification was successful in profiles, send notification
      if (verificationSuccess) {
        try {
          // Send verification notification
          await sendVerificationNotification(userId);
          console.log(`Verification notification sent to user ${userId}`);
        } catch (notifError) {
          console.error('Error sending verification notification:', notifError);
          // Continue even if notification fails
        }
      }
      
      // If both updates failed, return false
      if (profileError) return false;
      
      // If only the users collection update failed but profiles worked, still return true
      return profileError === null;
    }
  } catch (error) {
    console.error('Error verifying user:', error);
    return false;
  }
};

// Check if a user is verified
export const isUserVerified = async (userId: string): Promise<boolean> => {
  try {
    const db = getFirestore();
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists() && profileSnap.data().is_verified === true) {
      return true;
    }
    
    // Try users collection if not found in profiles
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists() && userSnap.data().is_verified === true) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user verification:', error);
    return false;
  }
};

// Get unread message count for the current user
export async function getUnreadMessageCount() {
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
    
    let totalUnread = 0;
    
    // Function to process each conversation
    const processConversation = async (doc: any) => {
      const conversationId = doc.id;
      const conversationData = doc.data();
      
      // Skip declined conversations
      if (conversationData.status === 'declined') {
        return 0;
      }
      
      // For each conversation, check if there are any unread messages
      // Get all messages in this conversation
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      
      // Count unread messages not sent by current user
      let unreadCount = 0;
      messagesSnap.forEach(messageDoc => {
        const messageData = messageDoc.data();
        if (!messageData.read && messageData.sender_id !== user.uid) {
          unreadCount++;
        }
      });
      
      return unreadCount;
    };
    
    // Process all conversations
    const conversationDocs = [...initiatedSnapshots.docs, ...receivedSnapshots.docs];
    const unreadCounts = await Promise.all(conversationDocs.map(processConversation));
    
    // Sum all unread counts
    totalUnread = unreadCounts.reduce((sum, count) => sum + count, 0);
    
    return totalUnread;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return 0; // Return 0 on error
  }
}

// Subscribe to unread message count in real-time
export function subscribeToUnreadMessageCount(callback: (count: number) => void) {
  const user = getCurrentUser();
  if (!user) {
    callback(0);
    return () => {};
  }
  
  // Keep track of all conversation subscriptions
  const subscriptions: (() => void)[] = [];
  
  // Function to count unread messages in a conversation
  const countUnreadInConversation = (messages: any[]) => {
    return messages.filter(msg => !msg.read && msg.sender_id !== user.uid).length;
  };
  
  // First, subscribe to all conversations
  const conversationsListener = () => {
    // Clean up any existing message subscriptions
    subscriptions.forEach(unsub => unsub());
    subscriptions.length = 0;
    
    // Query for user's conversations
    const q1 = query(
      collection(db, 'conversations'),
      where('initiator_id', '==', user.uid)
    );
    
    const q2 = query(
      collection(db, 'conversations'),
      where('receiver_id', '==', user.uid)
    );
    
    // Listen to conversations where user is initiator
    const unsubInitiator = onSnapshot(q1, initiatorSnapshot => {
      processConversationChanges(initiatorSnapshot.docs);
    }, error => {
      console.error('Error in unread initiator subscription:', error);
    });
    
    // Listen to conversations where user is receiver
    const unsubReceiver = onSnapshot(q2, receiverSnapshot => {
      processConversationChanges(receiverSnapshot.docs);
    }, error => {
      console.error('Error in unread receiver subscription:', error);
    });
    
    // Process conversation changes by setting up message listeners
    const processConversationChanges = (conversationDocs: any[]) => {
      conversationDocs.forEach(conversationDoc => {
        const conversationId = conversationDoc.id;
        const conversationData = conversationDoc.data();
        
        // Skip declined conversations
        if (conversationData.status === 'declined') {
          return;
        }
        
        // Subscribe to messages in this conversation
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        
        const unsubMessages = onSnapshot(messagesQuery, messagesSnapshot => {
          // Count unread messages across all conversations
          let totalUnread = 0;
          
          // Get all messages from this conversation
          const messages = messagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Update total unread count
          const unreadInThisConversation = countUnreadInConversation(messages);
          updateTotalUnreadCount();
        }, error => {
          console.error(`Error in messages subscription for ${conversationId}:`, error);
        });
        
        // Store the unsubscribe function
        subscriptions.push(unsubMessages);
      });
    };
    
    return () => {
      unsubInitiator();
      unsubReceiver();
      // Clean up all message subscriptions
      subscriptions.forEach(unsub => unsub());
    };
  };
  
  // Start listening
  const unsubscribe = conversationsListener();
  
  // Function to update the total unread count by querying all conversations
  const updateTotalUnreadCount = async () => {
    try {
      const count = await getUnreadMessageCount();
      callback(count);
    } catch (error) {
      console.error('Error updating unread count:', error);
      // Don't propagate errors to the UI - return last known count or 0
      // This ensures UI doesn't break if there are temporary Firestore issues
      callback(0);
    }
  };
  
  // Initial count
  updateTotalUnreadCount();
  
  // Return unsubscribe function
  return unsubscribe;
}

// Mark all messages in a conversation as read by the current user
export async function markMessagesAsRead(conversationId: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Query all messages in the conversation
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    
    // If no messages, return early
    if (messagesSnap.empty) {
      return 0;
    }
    
    // Create a batch write operation for efficiency
    const batch = writeBatch(db);
    
    // Mark each message as read if it's unread and not from the current user
    let updatedCount = 0;
    messagesSnap.forEach(messageDoc => {
      const messageData = messageDoc.data();
      if (!messageData.read && messageData.sender_id !== user.uid) {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageDoc.id);
        batch.update(messageRef, { read: true });
        updatedCount++;
      }
    });
    
    // If no messages to update, return early
    if (updatedCount === 0) {
      return 0;
    }
    
    // Commit the batch
    await batch.commit();
    console.log(`Marked ${updatedCount} messages as read in conversation ${conversationId}`);
    return updatedCount;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return 0;
  }
}

// Delete a conversation and its messages
export async function deleteConversation(conversationId: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Check if the conversation exists and user has permission
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      return { success: true, message: 'Conversation already deleted' };
    }
    
    const conversationData = conversationSnap.data();
    
    // Check if user is part of the conversation
    if (conversationData.initiator_id !== user.uid && conversationData.receiver_id !== user.uid) {
      throw new Error('Not authorized to delete this conversation');
    }
    
    // Get all messages in the conversation
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    
    // Batch delete all messages
    const batch = writeBatch(db);
    messagesSnap.forEach(messageDoc => {
      batch.delete(doc(db, 'conversations', conversationId, 'messages', messageDoc.id));
    });
    
    // Delete the conversation document itself
    batch.delete(conversationRef);
    
    // Commit the batch
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
}

// Function to update user password
export const updateUserPassword = async (currentPassword: string, newPassword: string) => {
  try {
    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('User not authenticated or email not available');
    }
    
    // First re-authenticate the user with their current password
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // After successful re-authentication, update the password
    await updatePassword(currentUser, newPassword);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating password:', error);
    
    let errorMessage = 'Failed to update password';
    if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect current password. Please try again.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'New password is too weak. Please use a stronger password.';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'This operation requires recent authentication. Please log in again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}; 