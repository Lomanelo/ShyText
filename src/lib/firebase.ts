import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirestore, GeoPoint, collection, doc, setDoc, updateDoc, getDoc, query, where, getDocs, addDoc, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
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

// Get current registration data
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
      
      // Note: Size limit check removed to allow larger images
      // Firebase Storage has a default max size of 10MB for the free plan
      // but we're removing the client-side check to allow larger uploads
      
      // Upload to Firebase Storage
      console.log('Uploading to Firebase Storage...');
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log('Successfully uploaded to Firebase Storage:', downloadURL);
      
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
      const existingConv = existingConvSnapshot.docs[0].data();
      if (existingConv.status === 'declined' && existingConv.initiator_id === user.uid) {
        throw new Error('This user has declined your previous conversation request');
      }
      if (existingConv.status === 'pending') {
        throw new Error('You already have a pending conversation with this user');
      }
      if (existingConv.status === 'accepted') {
        return { success: true, conversationId: existingConvSnapshot.docs[0].id };
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
        // Import locally to avoid circular dependency
        const { sendChatRequestNotification } = require('../utils/notifications');
        
        // Send a local notification for the chat request
        await sendChatRequestNotification(
          senderProfile?.display_name || 'Someone',
          message,
          newConversationRef.id,
          user.uid
        );
        
        console.log('Chat request notification sent successfully');
      } catch (notifError) {
        console.error('Error sending chat request notification:', notifError);
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
          // Import locally to avoid circular dependency
          const { sendLocalNotification } = require('../utils/notifications');
          
          // Send notification of acceptance
          await sendLocalNotification(
            'Chat Request Accepted',
            `${userProfile?.display_name || 'Someone'} accepted your chat request`,
            {
              type: 'message',
              conversationId,
              senderId: 'system',
              timestamp: new Date().toISOString()
            }
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
        // Import locally to avoid circular dependency
        const { sendLocalNotification } = require('../utils/notifications');
        
        // Send a local notification for immediate delivery
        await sendLocalNotification(
          `Message from ${senderProfile?.display_name || 'Someone'}`,
          content.length > 40 ? content.substring(0, 37) + '...' : content,
          {
            type: 'message',
            conversationId,
            senderId: user.uid,
            timestamp: new Date().toISOString()
          }
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
    conversations.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
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
    
    return { 
      success: true, 
      conversation: {
        ...conversationData,
        id: conversationId,
        otherUserId
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

// New functions for device UUID management
export const storeDeviceUUID = async (userId: string, uuid: string): Promise<boolean> => {
  try {
    const db = getFirestore();
    await setDoc(doc(db, 'user_devices', userId), {
      device_uuid: uuid,
      last_updated: serverTimestamp()
    }, { merge: true });
    
    // Also update the user's profile with this UUID
    await updateDoc(doc(db, 'users', userId), {
      device_uuid: uuid,
      last_updated: serverTimestamp()
    });
    
    console.log(`Stored device UUID ${uuid} for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error storing device UUID:', error);
    return false;
  }
};

// Function to get user by device UUID
export const getUserByDeviceUUID = async (uuid: string): Promise<any | null> => {
  try {
    const db = getFirestore();
    const q = query(collection(db, 'users'), where('device_uuid', '==', uuid));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No user found with device UUID:', uuid);
      return null;
    }
    
    // Return the first matching user
    const userData = querySnapshot.docs[0].data();
    return {
      id: querySnapshot.docs[0].id,
      ...userData
    };
  } catch (error) {
    console.error('Error finding user by device UUID:', error);
    return null;
  }
};

// Function to get user's device UUID
export const getCurrentUserDeviceUUID = async (): Promise<string | null> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    
    const db = getFirestore();
    const docRef = doc(db, 'user_devices', currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().device_uuid || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user device UUID:', error);
    return null;
  }
}; 