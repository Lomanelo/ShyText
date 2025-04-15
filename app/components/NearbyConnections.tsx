import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, Alert, Platform, PermissionsAndroid } from 'react-native';
import { Strategy } from 'expo-nearby-connections';
import { auth } from '../../src/lib/firebase';
import { getDatabase, ref, onValue, get, set } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function NearbyConnectionsComponent() {
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
    if (!permissionsGranted) return;
    
    const fetchUserProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error('No authenticated user found');
          return;
        }
        
        const db = getDatabase();
        const userProfileRef = ref(db, `profiles/${currentUser.uid}`);
        
        // Get user profile from Firebase
        const snapshot = await get(userProfileRef);
        
        if (snapshot.exists()) {
          const profileData = snapshot.val();
          // Log only necessary profile data without the photoURL base64 string
          console.log('Found user profile:', { 
            firstName: profileData.firstName, 
            email: profileData.email,
            userId: currentUser.uid,
            hasPhoto: !!profileData.photoURL
          });
          
          setUserData({
            userId: currentUser.uid,
            displayName: profileData.firstName || currentUser.displayName || 'Anonymous',
            photoURL: profileData.photoURL || currentUser.photoURL
          });
        } else {
          // No profile found, try to get cached profile
          const cachedProfile = await AsyncStorage.getItem('userProfile');
          
          if (cachedProfile) {
            const profileData = JSON.parse(cachedProfile);
            console.log('Using cached profile:', profileData);
            
            setUserData({
              userId: currentUser.uid,
              displayName: profileData.firstName || currentUser.displayName || 'Anonymous',
              photoURL: profileData.photoURL || currentUser.photoURL
            });
          } else {
            // Fallback to Firebase user data
            setUserData({
              userId: currentUser.uid,
              displayName: currentUser.displayName || 'Anonymous',
              photoURL: currentUser.photoURL
            });
          }
          
          // Update status in real-time database
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
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        
        // Fallback to current user basic data
        const currentUser = auth.currentUser;
        if (currentUser) {
          setUserData({
            userId: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            photoURL: currentUser.photoURL
          });
        }
      }
    };
    
    fetchUserProfile();
  }, [permissionsGranted]);
  
  // Safely start advertising and discovering when user data is available
  useEffect(() => {
    if (!userData || !libraryReady || !permissionsGranted) return;
    
    // Delay starting services to ensure UI is rendered
    const timer = setTimeout(() => {
      handleStartAdvertising();
      
      // Add another timeout for discovery to avoid running both operations simultaneously
      setTimeout(() => {
        handleStartDiscovery();
      }, 1000);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [userData, libraryReady, permissionsGranted]);
  
  // Safe start advertising with error handling (modified to use saved peerId)
  const handleStartAdvertising = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    try {
      if (!NearbyConnections || !userData) return;
      
      // Don't start if already advertising
      if (isAdvertising) return;
      
      setIsAdvertising(true);
      
      // Create a unique payload with user ID and display name
      // Use both userId and displayName to ensure uniqueness
      const payload = `${userData.userId}|${userData.displayName}`;
      
      console.log('Starting advertising with payload:', payload);
      
      // Use the saved peerId if available, otherwise let the library generate one
      let peerId;
      if (myPeerId) {
        // Try to use existing peer ID
        peerId = await NearbyConnections.startAdvertise(
          payload,
          Strategy.P2P_STAR,
          myPeerId // Pass the saved ID as a hint (library may or may not use it)
        );
      } else {
        // Generate a new ID
        peerId = await NearbyConnections.startAdvertise(
          payload,
          Strategy.P2P_STAR
        );
      }
      
      console.log('Advertising started, peerId:', peerId);
      
      // Save the peer ID for future use
      try {
        await AsyncStorage.setItem('my_nearby_peer_id', peerId);
        console.log('Saved peer ID to storage');
      } catch (saveError) {
        console.error('Failed to save peer ID:', saveError);
      }
      
      setMyPeerId(peerId);
      
      // Update Firebase with user's profile info
      updateUserProfileInFirebase(userData);
    } catch (error) {
      console.error('Error starting advertising:', error);
      setIsAdvertising(false);
      setErrorMessage('Could not make you visible to others');
    }
  };
  
  // Safe start discovering with error handling
  const handleStartDiscovery = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    try {
      if (!NearbyConnections || !userData) return;
      
      // Don't start if already discovering
      if (isDiscovering) return;
      
      setIsDiscovering(true);
      
      // Create a simple payload with user ID and display name only
      // DO NOT include the photoURL in the payload to avoid crashes with long URLs
      const payload = `${userData.userId}|${userData.displayName}`;
      
      console.log('Starting discovery with payload:', payload);
      
      const peerId = await NearbyConnections.startDiscovery(
        payload,
        Strategy.P2P_STAR
      );
      
      console.log('Discovery started, peerId:', peerId);
      setMyPeerId(peerId);
      
      // Update Firebase with user's profile info
      updateUserProfileInFirebase(userData);
    } catch (error) {
      console.error('Error starting discovery:', error);
      setIsDiscovering(false);
      setErrorMessage('Could not search for nearby users');
    }
  };

  // Update user profile info in Firebase
  const updateUserProfileInFirebase = async (userProfile: {
    userId: string;
    displayName: string;
    photoURL?: string | null;
  }) => {
    try {
      if (!userProfile.userId) return;
      
      const db = getDatabase();
      const userProfileRef = ref(db, `users/${userProfile.userId}`);
      
      // Update user profile data in Firebase
      await set(userProfileRef, {
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || null,
        lastSeen: new Date().toISOString(),
        peerId: myPeerId || null
      });
      
      console.log('User profile updated in Firebase');
    } catch (error) {
      console.error('Error updating user profile in Firebase:', error);
    }
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

  // Parse peer identity from the advertised/discovery name
  const parsePeerIdentity = (name: string): Peer => {
    try {
      // Try to parse as pipe-delimited string: userId|displayName
      const parts = name.split('|');
      if (parts.length >= 2) {
        const userId = parts[0] || '';
        const displayName = parts[1] || 'Unknown';
        
        // Create peer object with user ID and display name
        const peer: Peer = {
          peerId: '',  // This will be set later
          name: displayName,
          userId: userId
        };
        
        // Fetch profile photo from Firebase if we have a userId
        if (userId) {
          fetchUserProfileFromFirebase(userId).then(profile => {
            if (profile.photoURL) {
              // Find and update the discovered or connected peer with the photo URL
              setDiscoveredPeers(peers => 
                peers.map(p => p.userId === userId ? { ...p, photoURL: profile.photoURL } : p)
              );
              
              setConnectedPeers(peers => 
                peers.map(p => p.userId === userId ? { ...p, photoURL: profile.photoURL } : p)
              );
            }
          });
        }
        
        return peer;
      }
      
      // Fallback to just using the name as-is
      return {
        peerId: '',
        name: name || 'Unknown'
      };
    } catch (e) {
      // If any error occurs, use as-is
      return {
        peerId: '',
        name: name || 'Unknown'
      };
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
        console.log('Invitation received from:', data.name, 'peerId:', data.peerId);
        
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Update discovered peers with user data
        setDiscoveredPeers(prev => {
          const existing = prev.find(p => p.peerId === data.peerId);
          if (existing) return prev;
          return [...prev, { ...peerIdentity, peerId: data.peerId }];
        });
        
        // Auto-accept connections for demo purposes
        acceptConnection(data.peerId);
      });

      const onConnectedListener = NearbyConnections.onConnected((data: ConnectionData) => {
        console.log('Connected to:', data.name, 'peerId:', data.peerId);
        
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Update connected peers with user data
        setConnectedPeers(prev => {
          const existing = prev.find(p => p.peerId === data.peerId);
          if (existing) return prev;
          return [...prev, { ...peerIdentity, peerId: data.peerId }];
        });
      });

      const onDisconnectedListener = NearbyConnections.onDisconnected((data: { peerId: string }) => {
        console.log('Disconnected from peerId:', data.peerId);
        setConnectedPeers(prev => prev.filter(peer => peer.peerId !== data.peerId));
      });

      const onPeerFoundListener = NearbyConnections.onPeerFound((data: ConnectionData) => {
        console.log('Peer found:', data.name, 'peerId:', data.peerId, 'myPeerId:', myPeerId);
        
        // Early check - if peerId matches, definitely skip
        if (data.peerId === myPeerId) {
          console.log('Skipping self-discovery - exact peerId match');
          return;
        }
        
        const peerIdentity = parsePeerIdentity(data.name);
        
        // Log peer identity without photoURL and only log necessary userData info
        console.log('Parsed peer identity:', { 
          name: peerIdentity.name, 
          userId: peerIdentity.userId 
        }, 'My user:', { 
          displayName: userData?.displayName,
          userId: userData?.userId
        });
        
        // Skip if this is the current user based on userId
        if (peerIdentity.userId === userData?.userId) {
          console.log('Skipping self-discovery - exact userId match');
          return;
        }
        
        // Additional check for name similarity in case userId doesn't match
        if (peerIdentity.name === userData?.displayName) {
          console.log('Skipping self-discovery - name match');
          return;
        }
        
        // Update discovered peers with user data, with enhanced duplicate prevention
        setDiscoveredPeers(prev => {
          // First check if we already have this peer by peerId
          const existingByPeerId = prev.find(p => p.peerId === data.peerId);
          if (existingByPeerId) {
            console.log('Skipping duplicate peer (by peerId)');
            return prev;
          }
          
          // Then check if we already have this peer by userId (most reliable)
          const existingByUserId = peerIdentity.userId && 
                                  prev.find(p => p.userId === peerIdentity.userId);
          if (existingByUserId) {
            console.log('Replacing older instance of same user (by userId)');
            // Replace the old entry with the new one (fresher data)
            return prev
              .filter(p => p.userId !== peerIdentity.userId)
              .concat([{ ...peerIdentity, peerId: data.peerId }]);
          }
          
          // Then check for duplicate usernames - ensure username uniqueness
          const existingByName = prev.find(p => p.name === peerIdentity.name);
          if (existingByName) {
            console.log('Found duplicate username, keeping most recent discovery');
            // Replace existing entry with this one (newer discovery)
            return prev
              .filter(p => p.name !== peerIdentity.name)
              .concat([{ ...peerIdentity, peerId: data.peerId }]);
          }
          
          // Final check to ensure we don't add ourselves
          if (data.peerId === myPeerId || peerIdentity.userId === userData?.userId) {
            console.log('Caught self-discovery in final check');
            return prev;
          }
          
          // Add the new peer since it's not a duplicate
          return [...prev, { ...peerIdentity, peerId: data.peerId }];
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

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Nearby Connections</Text>
        {userData && (
          <View style={styles.userInfoContainer}>
            {userData.photoURL ? (
              <Image 
                source={{ uri: userData.photoURL }} 
                style={styles.userProfileImage} 
              />
            ) : (
              <View style={styles.userProfilePlaceholder}>
                <Text style={styles.userProfilePlaceholderText}>
                  {userData.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.userInfo}>
              Connected as: {userData.displayName}
            </Text>
          </View>
        )}
      </View>
      
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
          <TouchableOpacity 
            style={styles.errorBannerButton}
            onPress={() => setErrorMessage(null)}>
            <Text style={styles.errorBannerButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.statusSection}>
        <View style={[styles.statusIndicator, isAdvertising ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>
            {isAdvertising ? '✓ Visible to others' : '✗ Not visible to others'}
          </Text>
        </View>
        <View style={[styles.statusIndicator, isDiscovering ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>
            {isDiscovering ? '✓ Looking for people' : '✗ Not looking for people'}
          </Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nearby Users</Text>
        {discoveredPeers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found nearby yet. Please wait...</Text>
          </View>
        ) : (
          <FlatList
            data={discoveredPeers}
            keyExtractor={(item, index) => `${item.peerId}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.peerItem}
                onPress={() => requestConnection(item.peerId)}>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.peerImage} />
                ) : (
                  <View style={styles.peerImagePlaceholder}>
                    <Text style={styles.peerImagePlaceholderText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.peerInfo}>
                  <Text style={styles.peerName}>{item.name}</Text>
                  <Text style={styles.peerSubtext}>Tap to connect</Text>
                </View>
                <View style={styles.connectIconContainer}>
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    style={styles.connectIcon}>
                    <Text style={styles.connectIconText}>+</Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Users</Text>
        {connectedPeers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No connected users. Connect to someone nearby to chat.</Text>
          </View>
        ) : (
          <FlatList
            data={connectedPeers}
            keyExtractor={(item, index) => `${item.peerId}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.connectedPeerItem}>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.peerImage} />
                ) : (
                  <View style={styles.peerImagePlaceholder}>
                    <Text style={styles.peerImagePlaceholderText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.peerInfo}>
                  <Text style={styles.peerName}>{item.name}</Text>
                  <Text style={styles.peerSubtext}>Connected</Text>
                </View>
                <View style={styles.connectedIndicator} />
              </View>
            )}
          />
        )}
      </View>

      {connectedPeers.length > 0 && (
        <View style={styles.chatSection}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <FlatList
            data={messages}
            keyExtractor={(item, index) => `${item.peerId}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.messageItem}>
                <View style={styles.messageHeader}>
                  {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.messageSenderImage} />
                  ) : (
                    <View style={styles.messageSenderImagePlaceholder}>
                      <Text style={styles.messageSenderImageText}>
                        {(item.senderName || 'Unknown').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.messageSender}>{item.senderName || 'Unknown'}</Text>
                </View>
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTimestamp}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet. Send a message to start a conversation.</Text>
              </View>
            }
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#888"
            />
            {connectedPeers.map((peer) => (
              <TouchableOpacity
                key={peer.peerId}
                style={styles.sendButton}
                onPress={() => sendMessage(peer.peerId)}
                disabled={!messageText.trim()}>
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  style={styles.sendButtonGradient}>
                  <Text style={styles.sendButtonText}>Send to {peer.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
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
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#FF4444',
  },
  errorBannerText: {
    color: '#FF4444',
    fontSize: 14,
    flex: 1,
  },
  errorBannerButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  headerSection: {
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  userProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  userProfilePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userProfilePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    color: '#A0A0A0',
    fontSize: 14,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statusIndicator: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statusActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  statusInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#666',
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#3B82F6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    flex: 1,
  },
  chatSection: {
    marginBottom: 20,
    flex: 2,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  peerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  peerImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  peerImagePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectedPeerItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  peerSubtext: {
    color: '#A0A0A0',
    fontSize: 12,
    marginTop: 4,
  },
  connectIconContainer: {
    marginLeft: 8,
  },
  connectIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  connectedIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginLeft: 8,
  },
  messageItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageSenderImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  messageSenderImagePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageSenderImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageSender: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  messageTimestamp: {
    color: '#888',
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'column',
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  sendButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 