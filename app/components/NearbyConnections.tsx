import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, Alert, Platform, PermissionsAndroid, Switch } from 'react-native';
import { Strategy } from 'expo-nearby-connections';
import { auth } from '../../src/lib/firebase';
import { getDatabase, ref, onValue, get, set, push, onDisconnect } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Import NearbyConnections in a try-catch block to handle potential import errors
let NearbyConnections: any = null;
try {
  NearbyConnections = require('expo-nearby-connections');
} catch (error) {
  console.error('Failed to import expo-nearby-connections:', error);
}

// Define the event data interfaces for type safety
interface InvitationData {
  peerId: string;
  name: string;
}

interface ConnectionData {
  peerId: string;
  name: string;
}

interface MessageData {
  peerId: string;
  text: string;
}

interface Peer {
  peerId: string;
  name: string;
  userId?: string;
  photoURL?: string | null;
}

interface Message {
  peerId: string;
  text: string;
  timestamp: number;
  senderName?: string;
  photoURL?: string | null;
}

// Define profile interface
interface ProfileData {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string;
  distance?: string; // In meters or "active X ago" format
  photoURL?: string | null;
}

// Component for displaying profile information in a card
const ProfileCard = ({ profile, onSendMessage }: { profile: ProfileData, onSendMessage: (profileId: string) => void }) => {
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileContent}>
        <Image 
          source={profile.photoURL ? { uri: profile.photoURL } : require('../../assets/images/icon.png')} 
          style={styles.profileImage} 
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile.name}</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.messageButton} 
        onPress={() => onSendMessage(profile.id)}
      >
        <Text style={styles.messageButtonText}>Message</Text>
      </TouchableOpacity>
    </View>
  );
};

// Component for displaying the list of nearby profiles
const ProfileList = ({ 
  profiles, 
  onSendMessage
}: { 
  profiles: ProfileData[],
  onSendMessage: (profileId: string) => void
}) => {
  return (
    <View style={styles.profileListContainer}>
      <Text style={styles.sectionTitle}>Profiles nearby</Text>
      <Text style={styles.sectionSubtitle}>See who's around and send a message.</Text>
      
      {profiles.length > 0 ? (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProfileCard profile={item} onSendMessage={onSendMessage} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.profileListContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#999" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No users found nearby</Text>
          <Text style={styles.emptySubtext}>Wait a moment or try moving to a more crowded area</Text>
        </View>
      )}
    </View>
  );
};

export default function NearbyConnectionsComponent() {
  const router = useRouter();
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [discoveredPeers, setDiscoveredPeers] = useState<Peer[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [libraryReady, setLibraryReady] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userData, setUserData] = useState<{
    userId: string;
    displayName: string;
    photoURL?: string | null;
  } | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  
  // Helper function for random age generation
  const getRandomAge = () => {
    return Math.floor(Math.random() * 15) + 20; // Random age between 20-34
  };
  
  // Convert discovered peers to profile format
  const nearbyProfiles = useMemo(() => {
    return discoveredPeers
      .filter(peer => {
        // Only include peers that have a valid userId
        return peer.userId && peer.name !== 'Loading...';
      })
      .map(peer => {
        const distance = `${(Math.random() * 5).toFixed(1)}m away`;
        
        return {
          id: peer.peerId,
          name: peer.name || "Anonymous",
          age: getRandomAge(),
          bio: "ShyText user",
          interests: "Looking to connect",
          distance: distance,
          photoURL: peer.photoURL
        };
      });
  }, [discoveredPeers]);
  
  // Load persistent peerId from storage if available when component mounts
  useEffect(() => {
    const loadSavedPeerId = async () => {
      try {
        const savedPeerId = await AsyncStorage.getItem('my_nearby_peer_id');
        if (savedPeerId) {
          console.log('Loaded saved peer ID:', savedPeerId);
          setMyPeerId(savedPeerId);
        }
      } catch (error) {
        console.error('Error loading saved peer ID:', error);
      }
    };
    
    loadSavedPeerId();
  }, []);
  
  // Check if library is available
  useEffect(() => {
    if (!NearbyConnections) {
      setErrorMessage('Nearby Connections library not available');
      return;
    }
    
    setLibraryReady(true);
  }, []);
  
  // Request necessary permissions
  useEffect(() => {
    if (!libraryReady) return;
    
    const requestPermissions = async () => {
      try {
        console.log('Requesting permissions...');
        
        // Request location permission first (common for iOS and Android)
        const locationPerm = await Location.requestForegroundPermissionsAsync();
        if (locationPerm.status !== 'granted') {
          setErrorMessage('Location permission is required for nearby connections');
          return;
        }
        
        // For Android, request additional permissions if on Android
        if (Platform.OS === 'android') {
          try {
            const granted = await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
              // Android 12+ permissions, will be ignored on older Android versions
              'android.permission.BLUETOOTH_SCAN',
              'android.permission.BLUETOOTH_CONNECT',
              'android.permission.BLUETOOTH_ADVERTISE'
            ]);
            
            console.log('Android permissions result:', granted);
            
            // Check if we got the critical location permissions
            if (
              granted['android.permission.ACCESS_FINE_LOCATION'] !== 'granted' && 
              granted['android.permission.ACCESS_COARSE_LOCATION'] !== 'granted'
            ) {
              setErrorMessage('Location permissions are required for nearby connections');
              return;
            }
            
            // For Bluetooth, we'll continue even if not granted as older devices may not need these explicit permissions
          } catch (btError) {
            console.error('Error requesting Android permissions:', btError);
            // Continue anyway as some permissions might be already granted
          }
        }
        
        console.log('All permissions requested, proceeding with the app');
        setPermissionsGranted(true);
      } catch (error) {
        console.error('Error requesting permissions:', error);
        setErrorMessage('Failed to request necessary permissions');
      }
    };
    
    requestPermissions();
  }, [libraryReady]);
  
  // Get current user data
  useEffect(() => {
    if (!libraryReady) return;

    const fetchUserProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.log('No authenticated user found');
          router.replace('/(auth)');
          return;
        }

        // Always fetch fresh data from Firebase
        const userProfileRef = ref(getDatabase(), `profiles/${currentUser.uid}`);
        const snapshot = await get(userProfileRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserData({
            userId: currentUser.uid,
            displayName: data.firstName || currentUser.displayName || 'Anonymous',
            photoURL: data.photoURL || currentUser.photoURL
          });
          
          // Update cache with fresh data
          await AsyncStorage.setItem('userProfile', JSON.stringify(data));
        } else {
          console.log('No profile found for user:', currentUser.uid);
          router.replace('/(auth)/profile');
          return;
        }

        // Set up real-time listener for profile updates
        onValue(userProfileRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setUserData({
              userId: currentUser.uid,
              displayName: data.firstName || currentUser.displayName || 'Anonymous',
              photoURL: data.photoURL || currentUser.photoURL
            });
          }
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        router.replace('/(auth)');
      }
    };

    fetchUserProfile();
  }, [libraryReady]);
  
  // Handle Ghost Mode toggle
  const handleToggleGhostMode = (value: boolean) => {
    setGhostMode(value);
    
    if (value) {
      // Enable Ghost Mode - stop advertising
      stopAdvertising();
    } else {
      // Disable Ghost Mode - start advertising
      handleStartAdvertising();
    }
  };
  
  // Safely start advertising and discovering when user data is available
  useEffect(() => {
    if (!userData || !libraryReady || !permissionsGranted) return;
    
    // Start immediately without delays
    if (!ghostMode) {
      handleStartAdvertising();
    }
    handleStartDiscovery();
    
    return () => {
      // Cleanup function remains the same
      if (isDiscovering && NearbyConnections) {
        NearbyConnections.stopDiscovery().catch((error: Error) => console.error('Error stopping discovery:', error));
      }
      if (isAdvertising && NearbyConnections) {
        NearbyConnections.stopAdvertise().catch((error: Error) => console.error('Error stopping advertising:', error));
      }
    };
  }, [userData, libraryReady, permissionsGranted, ghostMode]);
  
  // Update handleStartAdvertising to be more immediate
  const handleStartAdvertising = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    try {
      if (!NearbyConnections || !userData) return;
      
      // Don't start if already advertising
      if (isAdvertising) return;
      
      setIsAdvertising(true);
      
      // Create a payload with ONLY the user ID
      const payload = userData.userId;
      
      // Use the saved peerId if available, otherwise let the library generate one
      let peerId;
      if (myPeerId) {
        peerId = await NearbyConnections.startAdvertise(
          payload,
          Strategy.P2P_STAR,
          myPeerId
        );
      } else {
        peerId = await NearbyConnections.startAdvertise(
          payload,
          Strategy.P2P_STAR
        );
      }
      
      setMyPeerId(peerId);
      
      // Update Firebase status and save peerId in parallel
      await Promise.all([
        updateUserOnlineStatus(userData.userId, peerId),
        AsyncStorage.setItem('my_nearby_peer_id', peerId).catch(error => 
          console.error('Failed to save peer ID:', error)
        )
      ]);
    } catch (error) {
      console.error('Error starting advertising:', error);
      setIsAdvertising(false);
      setErrorMessage('Could not make you visible to others');
    }
  };
  
  // Update handleStartDiscovery to be more immediate
  const handleStartDiscovery = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    try {
      if (!NearbyConnections || !userData) return;
      
      // Don't start if already discovering
      if (isDiscovering) return;
      
      setIsDiscovering(true);
      
      const payload = userData.userId;
      const peerId = await NearbyConnections.startDiscovery(
        payload,
        Strategy.P2P_STAR
      );
      
      setMyPeerId(peerId);
      
      // Update Firebase status immediately
      await updateUserOnlineStatus(userData.userId, peerId);
    } catch (error) {
      console.error('Error starting discovery:', error);
      setIsDiscovering(false);
      setErrorMessage('Could not search for nearby users');
    }
  };

  // Add new function to check if a user is online
  const checkUserOnlineStatus = async (userId: string): Promise<boolean> => {
    try {
      const db = getDatabase();
      const userStatusRef = ref(db, `userStatus/${userId}`);
      const snapshot = await get(userStatusRef);
      
      if (snapshot.exists()) {
        const status = snapshot.val();
        const lastSeen = new Date(status.lastSeen).getTime();
        const now = new Date().getTime();
        const twoMinutes = 2 * 60 * 1000;
        
        const isOnline = status.online && (now - lastSeen) < twoMinutes;
        console.log(`User ${userId} online status:`, {
          online: status.online,
          lastSeen: new Date(status.lastSeen).toISOString(),
          timeDiff: (now - lastSeen) / 1000,
          isOnline
        });
        
        return isOnline;
      }
      
      console.log(`No online status found for user ${userId}`);
      return true; // Default to showing users if no status found
    } catch (error) {
      console.error('Error checking user online status:', error);
      return true; // Default to showing users on error
    }
  };

  // Update loadUserFromFirebase to batch load profiles
  const loadUserFromFirebase = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      const db = getDatabase();
      
      // First check profiles collection
      const profileRef = ref(db, `profiles/${userId}`);
      const userRef = ref(db, `users/${userId}`);
      const statusRef = ref(db, `userStatus/${userId}`);
      
      // Fetch all data in parallel
      const [profileSnapshot, userSnapshot, statusSnapshot] = await Promise.all([
        get(profileRef),
        get(userRef),
        get(statusRef)
      ]);
      
      // Check online status first
      if (!statusSnapshot.exists() || !statusSnapshot.val().online) {
        removePeerWithUserId(userId);
        return false;
      }
      
      let userData = {
        name: '',
        photoURL: null,
        userId: userId
      };
      
      // Try profile data first
      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.val();
        userData.name = profileData.firstName || '';
        userData.photoURL = profileData.photoURL || null;
      }
      
      // Fallback to user data if needed
      if (!userData.name && userSnapshot.exists()) {
        const userProfileData = userSnapshot.val();
        userData.name = userProfileData.displayName || '';
        userData.photoURL = userProfileData.photoURL || null;
      }
      
      // Only update if we have a valid name
      if (userData.name) {
        updatePeerWithUserData(userId, userData);
        return true;
      }
      
      removePeerWithUserId(userId);
      return false;
    } catch (error) {
      console.error('Error loading user from Firebase:', error);
      removePeerWithUserId(userId);
      return false;
    }
  };

  // Add batch profile loading function
  const loadMultipleUserProfiles = async (userIds: string[]) => {
    try {
      const db = getDatabase();
      const uniqueIds = [...new Set(userIds)];
      
      // Create all promises for parallel execution
      const profilePromises = uniqueIds.map(id => get(ref(db, `profiles/${id}`)));
      const userPromises = uniqueIds.map(id => get(ref(db, `users/${id}`)));
      const statusPromises = uniqueIds.map(id => get(ref(db, `userStatus/${id}`)));
      
      // Execute all promises in parallel
      const [profileSnapshots, userSnapshots, statusSnapshots] = await Promise.all([
        Promise.all(profilePromises),
        Promise.all(userPromises),
        Promise.all(statusPromises)
      ]);
      
      // Process results
      const results = new Map();
      
      uniqueIds.forEach((userId, index) => {
        // Check online status first
        const status = statusSnapshots[index].val();
        if (!status || !status.online) {
          removePeerWithUserId(userId);
          return;
        }
        
        let userData = {
          name: '',
          photoURL: null,
          userId: userId
        };
        
        // Try profile data first
        const profileData = profileSnapshots[index].val();
        if (profileData) {
          userData.name = profileData.firstName || '';
          userData.photoURL = profileData.photoURL || null;
        }
        
        // Fallback to user data if needed
        if (!userData.name) {
          const userProfileData = userSnapshots[index].val();
          if (userProfileData) {
            userData.name = userProfileData.displayName || '';
            userData.photoURL = userProfileData.photoURL || null;
          }
        }
        
        if (userData.name) {
          results.set(userId, userData);
        } else {
          removePeerWithUserId(userId);
        }
      });
      
      // Batch update peers with user data
      const validUsers = Array.from(results.values());
      if (validUsers.length > 0) {
        setDiscoveredPeers(peers => {
          const updatedPeers = peers.map(peer => {
            const userData = results.get(peer.userId);
            return userData ? { ...peer, name: userData.name, photoURL: userData.photoURL } : peer;
          });
          return updatedPeers.filter(peer => peer.name !== 'Loading...');
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error batch loading user profiles:', error);
      return new Map();
    }
  };

  // Update the periodic online status check to be more efficient
  useEffect(() => {
    if (!discoveredPeers.length) return;

    const checkOnlineStatus = async () => {
      console.log('Checking online status for', discoveredPeers.length, 'peers');
      
      const userIds = discoveredPeers
        .filter(peer => peer.userId)
        .map(peer => peer.userId);
      
      if (userIds.length === 0) return;
      
      try {
        const db = getDatabase();
        const statusPromises = userIds.map(id => 
          get(ref(db, `userStatus/${id}`))
        );
        
        const snapshots = await Promise.all(statusPromises);
        const offlineUsers = new Set();
        
        snapshots.forEach((snapshot, index) => {
          const userId = userIds[index];
          const status = snapshot.val();
          
          if (!status || !status.online) {
            offlineUsers.add(userId);
          }
        });
        
        if (offlineUsers.size > 0) {
          setDiscoveredPeers(prev => 
            prev.filter(peer => !peer.userId || !offlineUsers.has(peer.userId))
          );
        }
      } catch (error) {
        console.error('Error checking online status:', error);
      }
    };

    // Check immediately
    checkOnlineStatus();

    // Then check every 30 seconds instead of every minute
    const interval = setInterval(checkOnlineStatus, 30000);

    return () => clearInterval(interval);
  }, [discoveredPeers.length]);

  // Update the updateUserOnlineStatus function
  const updateUserOnlineStatus = async (userId: string, peerId: string) => {
    try {
      const db = getDatabase();
      const userStatusRef = ref(db, `userStatus/${userId}`);
      
      // Update online status
      const status = {
        online: true,
        peerId: peerId,
        lastSeen: new Date().toISOString()
      };
      
      await set(userStatusRef, status);
      console.log('Updated online status for user:', userId, status);
      
      // Set up automated cleanup on disconnect
      const onlineRef = ref(db, '.info/connected');
      onValue(onlineRef, (snapshot) => {
        if (snapshot.val() === true) {
          const userStatusOfflineRef = ref(db, `userStatus/${userId}`);
          onDisconnect(userStatusOfflineRef).set({
            online: false,
            lastSeen: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  // Add new function to remove peers that don't exist in Firebase
  const removePeerWithUserId = (userId: string) => {
    // Remove from discovered peers
    setDiscoveredPeers(peers => 
      peers.filter(p => p.userId !== userId)
    );
    
    // Remove from connected peers
    setConnectedPeers(peers => 
      peers.filter(p => p.userId !== userId)
    );
  };

  // Update parsePeerIdentity to prevent adding unrecognized users to the UI
  const parsePeerIdentity = (name: string): Peer | null => {
    try {
      // The name is now just the Firebase UID
      const userId = name.trim();
      
      if (!userId) {
        return null;
      }
      
      // Create a temporary peer object with minimal data
      const tempPeer: Peer = {
        peerId: '',
        name: 'Loading...',
        userId: userId
      };
      
      // Immediately fetch the complete user profile from Firebase
      // This will either update the peer with real data or remove it if not found
      loadUserFromFirebase(userId);
      
      return tempPeer;
    } catch (e) {
      // If any parsing errors, don't add to the UI
      return null;
    }
  };

  // Helper to update peer lists with user data
  const updatePeerWithUserData = (userId: string, userData: { name: string, photoURL: string | null, userId: string }) => {
    // Update discovered peers
    setDiscoveredPeers(peers => 
      peers.map(p => p.userId === userId ? { ...p, name: userData.name, photoURL: userData.photoURL } : p)
    );
    
    // Update connected peers
    setConnectedPeers(peers => 
      peers.map(p => p.userId === userId ? { ...p, name: userData.name, photoURL: userData.photoURL } : p)
    );
  };

  // Start advertising
  const startAdvertising = async () => {
    handleStartAdvertising();
  };
 
  // Start discovering
  const startDiscovering = async () => {
    handleStartDiscovery();
  };
 
  // Stop advertising
  const stopAdvertising = async () => {
    try {
      if (!NearbyConnections) return;
      await NearbyConnections.stopAdvertise();
      setIsAdvertising(false);
    } catch (error) {
      console.error('Error stopping advertising:', error);
    }
  };
 
  // Stop discovering
  const stopDiscovering = async () => {
    try {
      if (!NearbyConnections) return;
      await NearbyConnections.stopDiscovery();
      setIsDiscovering(false);
    } catch (error) {
      console.error('Error stopping discovery:', error);
    }
  };

  // Request connection
  const requestConnection = async (peerId: string) => {
    try {
      if (!NearbyConnections) return;
      await NearbyConnections.requestConnection(peerId);
    } catch (error) {
      console.error('Error requesting connection:', error);
      setErrorMessage('Could not connect to user');
    }
  };
        
  // Accept connection
  const acceptConnection = async (peerId: string) => {
    try {
      if (!NearbyConnections) return;
      await NearbyConnections.acceptConnection(peerId);
    } catch (error) {
      console.error('Error accepting connection:', error);
    }
  };
  
  // Fetch user profile from Firebase
  const fetchUserProfileFromFirebase = async (userId: string): Promise<{
    displayName?: string;
    photoURL?: string | null;
  }> => {
    try {
      const db = getDatabase();
      const userProfileRef = ref(db, `users/${userId}`);
      
      const snapshot = await get(userProfileRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
      
      return {};
    } catch (error) {
      console.error('Error fetching user profile from Firebase:', error);
      return {};
    }
  };

  // Send message
  const sendMessage = async (peerId: string) => {
    if (!messageText.trim() || !NearbyConnections) return;
    
    try {
      // Create message with metadata (simple format)
      // Don't include photoURL in the message payload
      const messageWithMetadata = `${messageText}|${userData?.displayName || 'Anonymous'}|${Date.now()}`;
      
      await NearbyConnections.sendText(peerId, messageWithMetadata);
      
      // Find the connected peer to get their userId
      const targetPeer = connectedPeers.find(p => p.peerId === peerId);
      
      // Add to local messages
      const newMessage = { 
        peerId, 
        text: messageText,
        timestamp: Date.now(),
        senderName: userData?.displayName || 'Anonymous',
        photoURL: userData?.photoURL
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      setMessageText('');
      
      // If we have the peer's userId, also store the message in Firebase for reliability
      if (targetPeer?.userId) {
        try {
          const db = getDatabase();
          const messageRef = ref(db, `messages/${userData?.userId}/${targetPeer.userId}/${Date.now()}`);
          
          await set(messageRef, {
            text: messageText,
            timestamp: Date.now(),
            senderName: userData?.displayName || 'Anonymous',
            senderId: userData?.userId,
            receiverId: targetPeer.userId
          });
        } catch (dbError) {
          console.error('Error saving message to Firebase:', dbError);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage('Could not send message');
    }
  };

  // Parse message text
  const parseMessageText = (text: string): { text: string; senderName: string; timestamp: number; } => {
    try {
      // Try to parse as pipe-delimited string: text|senderName|timestamp
      const parts = text.split('|');
      if (parts.length >= 3) {
        return {
          text: parts[0] || '',
          senderName: parts[1] || 'Unknown',
          timestamp: parseInt(parts[2]) || Date.now(),
        };
      }
      
      // Fallback to just using the text as-is
      return {
        text,
        senderName: 'Unknown',
        timestamp: Date.now()
      };
    } catch (e) {
      // If any error occurs, use as-is
      return {
        text,
        senderName: 'Unknown',
        timestamp: Date.now()
      };
    }
  };

  // Set up event listeners
  useEffect(() => {
    if (!NearbyConnections || !libraryReady || !permissionsGranted) return;
    
    try {
      const onInvitationListener = NearbyConnections.onInvitationReceived((data: InvitationData) => {
        // Parse the peer identity (UID)
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Only proceed if we have a valid identity and it's not ourselves
        if (!peerIdentity || peerIdentity.userId === userData?.userId) {
          return;
        }
        
        // Update discovered peers with user data if valid
        setDiscoveredPeers(prev => {
          const existing = prev.find(p => p.peerId === data.peerId);
          if (existing) return prev;
          return [...prev, { ...peerIdentity, peerId: data.peerId }];
        });
        
        // Auto-accept connections for valid peers
        acceptConnection(data.peerId);
      });

      const onConnectedListener = NearbyConnections.onConnected((data: ConnectionData) => {
        // Parse the peer identity from the name (now just a Firebase UID)
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Only proceed if we have a valid identity and it's not ourselves
        if (!peerIdentity || peerIdentity.userId === userData?.userId) {
          return;
        }
        
        // Update connected peers with user data
        setConnectedPeers(prev => {
          const existing = prev.find(p => p.peerId === data.peerId);
          if (existing) return prev;
          return [...prev, { ...peerIdentity, peerId: data.peerId }];
        });
      });

      const onDisconnectedListener = NearbyConnections.onDisconnected((data: { peerId: string }) => {
        // Remove the disconnected peer from connected peers list without logging
        setConnectedPeers(prev => prev.filter(peer => peer.peerId !== data.peerId));
      });

      const onPeerFoundListener = NearbyConnections.onPeerFound((data: ConnectionData) => {
        // Early check - if peerId matches, definitely skip
        if (data.peerId === myPeerId) {
          return;
        }
        
        // Parse the peer identity (just Firebase UID now)
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Skip if no valid peer identity or if this is the current user
        if (!peerIdentity || peerIdentity.userId === userData?.userId) {
          return;
        }
        
        // Update discovered peers with minimal user data
        setDiscoveredPeers(prev => {
          // First check if we already have this peer by peerId
          const existingByPeerId = prev.find(p => p.peerId === data.peerId);
          if (existingByPeerId) {
            return prev;
          }
          
          // Then check if we already have this peer by userId
          const existingByUserId = peerIdentity.userId && 
                                  prev.find(p => p.userId === peerIdentity.userId);
          if (existingByUserId) {
            // Replace the old entry with the new one
            return prev
              .filter(p => p.userId !== peerIdentity.userId)
              .concat([{ ...peerIdentity, peerId: data.peerId }]);
          }
          
          // Final check to ensure we don't add ourselves
          if (data.peerId === myPeerId || peerIdentity.userId === userData?.userId) {
            return prev;
          }
          
          // Add the new peer
          const newPeers = [...prev, { ...peerIdentity, peerId: data.peerId }];
          
          // Trigger batch profile loading for any peers without full data
          const peersToLoad = newPeers
            .filter(p => p.name === 'Loading...' && p.userId !== undefined)
            .map(p => p.userId as string);
          
          if (peersToLoad.length > 0) {
            loadMultipleUserProfiles(peersToLoad);
          }
          
          return newPeers;
        });
      });

      const onPeerLostListener = NearbyConnections.onPeerLost((data: { peerId: string }) => {
        console.log('Peer lost, peerId:', data.peerId);
        setDiscoveredPeers(prev => prev.filter(peer => peer.peerId !== data.peerId));
      });

      const onTextReceivedListener = NearbyConnections.onTextReceived((data: MessageData) => {
        console.log('Text received from peerId:', data.peerId, 'text:', data.text);
        
        const { text: messageText, senderName, timestamp } = parseMessageText(data.text);
        
        // Find the connected peer to get their userId for looking up photoURL
        const sender = connectedPeers.find(p => p.peerId === data.peerId);
        
        // Add to local messages
        const newMessage = { 
          peerId: data.peerId, 
          text: messageText,
          timestamp,
          senderName,
          photoURL: sender?.photoURL
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // If we have the sender's userId, also fetch their profile photo if we don't have it yet
        if (sender?.userId && !sender.photoURL) {
          fetchUserProfileFromFirebase(sender.userId).then(profile => {
            if (profile.photoURL) {
              // Update the connected peer with the photo URL
              setConnectedPeers(peers => 
                peers.map(p => p.peerId === data.peerId ? { ...p, photoURL: profile.photoURL } : p)
              );
              
              // Also update the message with the photo URL
              setMessages(msgs => 
                msgs.map(m => m.peerId === data.peerId && m.timestamp === timestamp ? 
                  { ...m, photoURL: profile.photoURL } : m)
              );
            }
          });
        }
      });

      // Return cleanup function
      return () => {
        console.log('Cleaning up listeners and connections...');
        try {
          // Stop discovery and advertising if active on unmount
          if (isDiscovering && NearbyConnections) {
            NearbyConnections.stopDiscovery().catch((error: Error) => console.error('Error stopping discovery:', error));
            // Clear discovered peers on unmount
            setDiscoveredPeers([]);
          }
          if (isAdvertising && NearbyConnections) {
            NearbyConnections.stopAdvertise().catch((error: Error) => console.error('Error stopping advertising:', error));
          }
          
          // Safely unsubscribe from all listeners if they exist
          if (onInvitationListener) onInvitationListener(null);
          if (onConnectedListener) onConnectedListener(null);
          if (onDisconnectedListener) onDisconnectedListener(null);
          if (onPeerFoundListener) onPeerFoundListener(null);
          if (onPeerLostListener) onPeerLostListener(null);
          if (onTextReceivedListener) onTextReceivedListener(null);
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up event listeners:', error);
      setErrorMessage('Failed to initialize nearby connections');
      return () => {}; // Return empty cleanup function
    }
  }, [libraryReady, permissionsGranted]);

  // Add effect to clean up any self-entries from discovered peers
  useEffect(() => {
    if (!userData || !myPeerId) return;
    
    // Filter out self from discovered peers if somehow added
    setDiscoveredPeers(prev => 
      prev.filter(peer => 
        peer.peerId !== myPeerId && 
        peer.userId !== userData.userId && 
        peer.name !== userData.displayName
      )
    );
  }, [userData, myPeerId, discoveredPeers.length]);

  // Update the deduplication effect with stronger username uniqueness enforcement
  useEffect(() => {
    if (!discoveredPeers.length) return;
    
    // Deduplicate peers with enhanced uniqueness rules
    const uniqueUserIds = new Set();
    const uniqueUsernames = new Set();
    const deduplicatedPeers = [];
    
    // Sort peers by most recently discovered first (assuming newer peers are at end of array)
    const sortedPeers = [...discoveredPeers].reverse();
    
    for (const peer of sortedPeers) {
      // First priority: userId-based uniqueness (most reliable)
      if (peer.userId) {
        if (!uniqueUserIds.has(peer.userId)) {
          uniqueUserIds.add(peer.userId);
          deduplicatedPeers.push(peer);
        }
      } 
      // Second priority: username-based uniqueness for peers without userId
      else if (peer.name) {
        if (!uniqueUsernames.has(peer.name.toLowerCase())) {
          uniqueUsernames.add(peer.name.toLowerCase());
          deduplicatedPeers.push(peer);
        }
      }
      // Fallback: peerId-based uniqueness for minimal information peers
      else if (!uniqueUserIds.has(peer.peerId)) {
        uniqueUserIds.add(peer.peerId);
        deduplicatedPeers.push(peer);
      }
    }
    
    // Revert the order to maintain discovery order
    deduplicatedPeers.reverse();
    
    // If we've removed duplicates, update the state
    if (deduplicatedPeers.length !== discoveredPeers.length) {
      console.log('Removed duplicate peers:', discoveredPeers.length - deduplicatedPeers.length);
      setDiscoveredPeers(deduplicatedPeers);
    }
  }, [discoveredPeers.length]);
  
  // Show error screen if library is not ready
  if (!libraryReady) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Nearby Feature Unavailable</Text>
        <Text style={styles.errorText}>
          The nearby connections feature could not be initialized.
        </Text>
        <Text style={styles.errorDetail}>
          This feature may not be supported on your device or in development mode.
        </Text>
      </View>
    );
  }
  
  // Show permissions screen if permissions are not granted
  if (!permissionsGranted) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Permissions Required</Text>
        <Text style={styles.errorText}>
          Location permissions are required for the nearby connections feature.
        </Text>
        <Text style={styles.errorDetail}>
          Please grant location permissions to use this feature.
        </Text>
      </View>
    );
  }

  // Replace navigateToChat function with startConversation
  const startConversation = async (peerId: string, peerName: string) => {
    try {
      // Find the peer to get their userId if available
      const peer = discoveredPeers.find(p => p.peerId === peerId);
      const userId = peer?.userId;
      
      if (!userId) {
        setErrorMessage('Cannot find user information for chat');
        return;
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMessage('You must be logged in to start a chat');
        return;
      }
      
      // Check if a conversation already exists between these users
      const db = getDatabase();
      const conversationsRef = ref(db, 'conversations');
      const existingConversationSnapshot = await get(conversationsRef);
      
      let existingConversationId = null;
      
      if (existingConversationSnapshot.exists()) {
        const conversations = existingConversationSnapshot.val();
        
        // Find any conversation between these two users
        for (const [id, convo] of Object.entries(conversations)) {
          const conversation = convo as any;
          
          if (
            (conversation.initiatorId === currentUser.uid && conversation.receiverId === userId) ||
            (conversation.initiatorId === userId && conversation.receiverId === currentUser.uid)
          ) {
            existingConversationId = id;
            break;
          }
        }
      }
      
      // If conversation exists, navigate to it
      if (existingConversationId) {
        router.push(`/chat/${existingConversationId}`);
        return;
      }
      
      // Otherwise, create a new conversation
      const newConversationRef = push(conversationsRef);
      const conversationId = newConversationRef.key;
      
      if (!conversationId) {
        setErrorMessage('Failed to create conversation');
        return;
      }
      
      // Create conversation data with explicit participants structure
      const conversationData = {
        initiatorId: currentUser.uid,
        receiverId: userId,
        createdAt: new Date().toISOString(),
        participants: {
          [currentUser.uid]: true,
          [userId]: true
        },
        lastUpdated: new Date().toISOString()
      };
      
      // Save the conversation
      await set(newConversationRef, conversationData);
      
      // Navigate to the chat screen
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      setErrorMessage(`Failed to start conversation with ${peerName}`);
    }
  };

  const handleSendMessage = (profileId: string) => {
    // Find the peer from discoveredPeers using the profileId (peerId)
    const peer = discoveredPeers.find(p => p.peerId === profileId);
    if (peer) {
      console.log(`Starting conversation with ${peer.name}`);
      startConversation(peer.peerId, peer.name);
    }
  };

  return (
    <LinearGradient
      colors={['#f9f1e7', '#f9f1e7']}
      style={styles.container}
    >
      <ProfileList 
        profiles={nearbyProfiles} 
        onSendMessage={handleSendMessage}
      />
      
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity 
            style={styles.errorDismissButton}
            onPress={() => setErrorMessage(null)}>
            <Text style={styles.errorDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileListContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  profileListContent: {
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginHorizontal: 4,
  },
  profileContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  messageButton: {
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageButtonText: {
    color: '#222',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  errorDismissButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorDismissText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    maxWidth: '80%',
  },
}); 