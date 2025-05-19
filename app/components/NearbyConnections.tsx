import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, Alert, Platform, PermissionsAndroid, Switch, AppState, Linking } from 'react-native';
import { Strategy } from 'expo-nearby-connections';
import { auth } from '../../src/lib/firebase';
import { getDatabase, ref, onValue, get, set, push, onDisconnect } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import * as NearbyConnections from 'expo-nearby-connections';
import ImagePreviewModal from './ImagePreviewModal';

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
  distance?: string;
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

interface Endpoint {
  id: string;
  name?: string;
}

interface Connection {
  id: string;
  status: string;
}

interface ConnectionResult {
  status: 'ACCEPTED' | 'REJECTED';
}

// Component for displaying profile information in a card
const ProfileCard = ({ profile, onSendMessage }: { profile: ProfileData, onSendMessage: (profileId: string) => void }) => {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileContent}>
        <TouchableOpacity onPress={() => setImageModalVisible(true)}>
        <Image 
          source={profile.photoURL ? { uri: profile.photoURL } : require('../../assets/images/icon.png')} 
          style={styles.profileImage} 
        />
        </TouchableOpacity>
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
      
      <ImagePreviewModal
        visible={imageModalVisible}
        imageUrl={profile.photoURL || null}
        onClose={() => setImageModalVisible(false)}
      />
    </View>
  );
};

// Component for displaying the list of nearby profiles
const ProfileList = ({ 
  profiles, 
  onSendMessage,
  onRefresh,
  refreshing
}: { 
  profiles: ProfileData[],
  onSendMessage: (profileId: string) => void,
  onRefresh: () => void,
  refreshing: boolean
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
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#999" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No users found nearby</Text>
          <Text style={styles.emptySubtext}>Wait a moment or try moving to a more crowded area</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={20} color="#666" style={styles.refreshIcon} />
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function NearbyConnectionsComponent() {
  const router = useRouter();
  const segments = useSegments();
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
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Refs
  const appState = useRef(AppState.currentState);
  const discoveryInterval = useRef<NodeJS.Timeout | null>(null);
  const locationUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const isDiscoveryStarting = useRef(false);

  // Memos
  const isTabActive = useMemo(() => {
    return segments.length > 0 && segments[0] === '(tabs)' && !segments[1];
  }, [segments]);
  
  // Helper functions
  const getRandomAge = () => {
    return Math.floor(Math.random() * 15) + 20; // Random age between 20-34
  };
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = 
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters
    
    return Math.round(distance);
  };
    
  const updateUserLocation = async () => {
      try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setUserLocation(location);
      
      if (userData?.userId) {
        const db = getDatabase();
        const userLocationRef = ref(db, `userLocations/${userData.userId}`);
        
        await set(userLocationRef, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
          lastUpdated: new Date().toISOString()
            });
          }
      } catch (error) {
      console.error('Error updating location:', error);
      }
    };

  const startLocationTracking = () => {
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
    }
    
    updateUserLocation();
    
    locationUpdateInterval.current = setInterval(() => {
      updateUserLocation();
    }, 60000);
  };

  const updatePeerWithDistance = (userId: string, distance: number) => {
    setDiscoveredPeers(peers => 
      peers.map(p => p.userId === userId ? { 
        ...p, 
        distance: `${distance < 1000 ? distance : Math.round(distance / 100) / 10 + 'k'}m away` 
      } : p)
    );
  };
  
  // Update the nearbyProfiles memo to include all peers
  const nearbyProfiles = useMemo(() => {
    console.log('Discovered peers:', discoveredPeers);
    
    // First, filter out own device and loading peers
    const filteredPeers = discoveredPeers.filter(peer => 
      // Filter out self by peerId, userId, and loading status
      peer.peerId !== myPeerId && 
      peer.name !== 'Loading...' && 
      peer.userId !== userData?.userId // Filter out self by userId
    );
    
    // Then deduplicate by userId
    const uniqueUserIds = new Set<string>();
    const uniquePeers = filteredPeers.filter(peer => {
      // If no userId, keep it but use peerId for uniqueness
      const idToCheck = peer.userId || peer.peerId;
      
      // If we've seen this userId already, skip it
      if (uniqueUserIds.has(idToCheck)) {
        return false;
      }
      
      // Otherwise, add to our set and keep this peer
      uniqueUserIds.add(idToCheck);
      return true;
    });
    
    // Map to profile data format
    return uniquePeers.map(peer => ({
      id: peer.peerId,
      name: peer.name || "Anonymous",
      age: getRandomAge(),
      bio: peer.userId ? "ShyText user" : "Unknown user",
      interests: peer.userId ? "Looking to connect" : "Not identified",
      photoURL: peer.photoURL
    }));
  }, [discoveredPeers, myPeerId, userData]);
  
  // When adding new discovered peers, check for duplicates by userId
  const addOrUpdateDiscoveredPeer = (newPeer: Peer) => {
    // Don't add self to the list of discovered peers
    if (newPeer.userId === userData?.userId) {
      console.log('Skipping self in discovered peers:', newPeer.peerId, newPeer.userId);
      return;
    }

    setDiscoveredPeers(prev => {
      // First check if this exact peerId already exists
      const existingPeerIndex = prev.findIndex(p => p.peerId === newPeer.peerId);
      
      if (existingPeerIndex >= 0) {
        // Update existing entry
        const updatedPeers = [...prev];
        updatedPeers[existingPeerIndex] = {
          ...updatedPeers[existingPeerIndex],
          ...newPeer,
          // Keep the existing name/photoURL if the new ones are undefined
          name: newPeer.name || updatedPeers[existingPeerIndex].name,
          photoURL: newPeer.photoURL || updatedPeers[existingPeerIndex].photoURL
        };
        return updatedPeers;
      }
      
      // If new peer has userId, check if we already have a peer with same userId
      if (newPeer.userId) {
        const existingUserIdIndex = prev.findIndex(p => p.userId === newPeer.userId);
        if (existingUserIdIndex >= 0) {
          // Update the existing entry with this userId
          const updatedPeers = [...prev];
          updatedPeers[existingUserIdIndex] = {
            ...updatedPeers[existingUserIdIndex],
            ...newPeer,
            // Keep the existing name/photoURL if the new ones are undefined
            name: newPeer.name || updatedPeers[existingUserIdIndex].name,
            photoURL: newPeer.photoURL || updatedPeers[existingUserIdIndex].photoURL
          };
          return updatedPeers;
        }
      }
      
      // If no existing entry found, add new peer
      return [...prev, newPeer];
    });
  };

  // Set up event listeners
  useEffect(() => {
    if (!libraryReady) return;

    const onPeerFoundListener = NearbyConnections.onPeerFound((data) => {
      console.log('Peer found:', data);
      try {
        // Extract userId from device name format: ShyText_userId
        let userId: string | undefined = undefined;
        const nameStr = data.name || '';
        
        if (nameStr.startsWith('ShyText_')) {
          userId = nameStr.substring(8); // Remove 'ShyText_' prefix
          console.log('Extracted userId from peer name:', userId);
        } else {
          // Also check if the name is directly a user ID
          const db = getDatabase();
          const profilesRef = ref(db, `profiles/${nameStr}`);
          get(profilesRef).then(snapshot => {
            if (snapshot.exists()) {
              userId = nameStr;
              console.log('Peer name is directly a userId:', userId);
              
              // Update with the userId
              addOrUpdateDiscoveredPeer({
                peerId: data.peerId,
                name: 'Loading...',
                userId: userId,
                photoURL: undefined,
                distance: undefined
              });
              
              // Load profile data
              loadUserProfile(userId);
            }
          }).catch(error => {
            console.log('Error checking if name is userId:', error);
          });
        }
        
        // Also check in peerInfo table by peerId
        const db = getDatabase();
        const peerInfoRef = ref(db, `peerInfo/${data.peerId}`);
        get(peerInfoRef).then(snapshot => {
          if (snapshot.exists()) {
            const peerData = snapshot.val();
            console.log('Found peer info in Firebase:', peerData);
            
            addOrUpdateDiscoveredPeer({
              peerId: data.peerId,
              name: peerData.displayName || 'Anonymous',
              userId: peerData.userId,
              photoURL: peerData.photoURL,
              distance: undefined
            });
          }
        }).catch(error => {
          console.log('Error fetching peer info:', error);
        });
        
        // Add the peer with basic info, will be updated later
        addOrUpdateDiscoveredPeer({
          peerId: data.peerId,
          name: 'Loading...',
          userId: userId,
          photoURL: undefined,
          distance: undefined
        });

        // If we have a user ID, load the profile
        if (userId) {
          loadUserProfile(userId);
        }
      } catch (error) {
        console.error('Error processing peer data:', error);
        addOrUpdateDiscoveredPeer({
          peerId: data.peerId,
          name: data.name || 'Anonymous',
          userId: undefined,
          photoURL: undefined,
          distance: undefined
        });
      }
    });

    const onPeerLostListener = NearbyConnections.onPeerLost((data) => {
      console.log('Peer lost:', data);
      setDiscoveredPeers(prev => prev.filter(p => p.peerId !== data.peerId));
    });

    const onInvitationListener = NearbyConnections.onInvitationReceived((data) => {
      console.log('Invitation received:', data);
      // Automatically accept connections
      NearbyConnections.acceptConnection(data.peerId).catch(error => {
        console.error('Error accepting connection:', error);
      });
    });

    const onConnectedListener = NearbyConnections.onConnected((data) => {
      console.log('Connected to peer:', data);
      setConnectedPeers(prev => {
        const existing = prev.find(p => p.peerId === data.peerId);
        if (existing) return prev;
        return [...prev, {
          peerId: data.peerId,
          name: data.name || 'Anonymous',
          userId: undefined,
          photoURL: undefined,
          distance: undefined
        }];
      });
    });

    const onDisconnectedListener = NearbyConnections.onDisconnected((data) => {
      console.log('Disconnected from peer:', data);
      setConnectedPeers(prev => prev.filter(p => p.peerId !== data.peerId));
      setDiscoveredPeers(prev => prev.filter(p => p.peerId !== data.peerId));
    });
    
    return () => {
      onPeerFoundListener();
      onPeerLostListener();
      onInvitationListener();
      onConnectedListener();
      onDisconnectedListener();
    };
  }, [libraryReady]);
  
  // Discovery and advertising functions
  const startDiscovering = async () => {
    if (!libraryReady || !permissionsGranted) return;
    try {
      const peerId = await NearbyConnections.startDiscovery("ShyText User", Strategy.P2P_CLUSTER);
      console.log('Started discovery with peer ID:', peerId);
      setMyPeerId(peerId);
      setIsDiscovering(true);
    } catch (error) {
      console.error('Error starting discovery:', error);
      setErrorMessage('Failed to start discovery');
    }
  };
  
  const stopDiscovering = async () => {
    if (!libraryReady) return;
    try {
      await NearbyConnections.stopDiscovery();
      setIsDiscovering(false);
    } catch (error) {
      console.error('Error stopping discovery:', error);
      }
  };

  const startAdvertising = async () => {
    if (!libraryReady || !permissionsGranted || !userData) return;
    try {
      // For iOS stability, use a simpler identifier format
      // iOS has issues with complex JSON strings in advertising names
      const deviceName = `ShyText_${userData.userId}`;
      
      console.log('Starting advertising with device name:', deviceName);
      const peerId = await NearbyConnections.startAdvertise(deviceName, Strategy.P2P_CLUSTER);
      console.log('Started advertising with peer ID:', peerId);
      
      // Store the user info in Firebase instead
      const db = getDatabase();
      const peerInfoRef = ref(db, `peerInfo/${peerId}`);
      await set(peerInfoRef, {
        userId: userData.userId,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        timestamp: Date.now()
      });
      
      setMyPeerId(peerId);
      setIsAdvertising(true);
    } catch (error) {
      console.error('Error starting advertising:', error);
      setErrorMessage('Failed to start advertising: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const stopAdvertising = async () => {
    if (!libraryReady) return;
    try {
      await NearbyConnections.stopAdvertise();
      setIsAdvertising(false);
    } catch (error) {
      console.error('Error stopping advertising:', error);
    }
  };
      
  // Initialize library and start discovery/advertising
  useEffect(() => {
    if (!libraryReady || !permissionsGranted || !userData) return;

    const initializeConnections = async () => {
      try {
        // Start both discovery and advertising
        await startDiscovering();
        await startAdvertising();
    } catch (error) {
        console.error('Error initializing connections:', error);
        setErrorMessage('Failed to initialize connections');
      }
    };

    initializeConnections();

    return () => {
      stopDiscovering();
      stopAdvertising();
    };
  }, [libraryReady, permissionsGranted, userData]);
      
  // Initialize library
  useEffect(() => {
    const initLibrary = async () => {
      try {
        if (!NearbyConnections) {
          setErrorMessage('Nearby Connections library not available');
          return;
        }
        
        // Test if the library is working by trying to start discovery
        await (NearbyConnections.startDiscovery as any)(String(Strategy.P2P_CLUSTER));
        await NearbyConnections.stopDiscovery();
        
        setLibraryReady(true);
    } catch (error) {
        console.error('Error initializing Nearby Connections:', error);
        setErrorMessage('Failed to initialize Nearby Connections');
      }
    };
    
    initLibrary();
  }, []);

  // Load saved peer ID
  useEffect(() => {
    const loadSavedPeerId = async () => {
      try {
        const savedPeerId = await AsyncStorage.getItem('my_nearby_peer_id');
        if (savedPeerId) {
          setMyPeerId(savedPeerId);
        }
      } catch (error) {
        console.error('Error loading saved peer ID:', error);
      }
    };
    loadSavedPeerId();
  }, []);

  // Get current user data
  useEffect(() => {
    if (!libraryReady) return;

    const fetchUserProfile = async () => {
      try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
          router.replace('/(auth)');
        return;
      }
      
        const userProfileRef = ref(getDatabase(), `profiles/${currentUser.uid}`);
        const snapshot = await get(userProfileRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserData({
            userId: currentUser.uid,
            displayName: data.firstName || currentUser.displayName || 'Anonymous',
            photoURL: data.photoURL || currentUser.photoURL
          });
        } else {
          router.replace('/(auth)/profile');
        return;
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        router.replace('/(auth)');
      }
    };

    fetchUserProfile();
  }, [libraryReady]);

  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (discoveredPeers.length === 0) {
        await stopDiscovering();
        await stopAdvertising();
        setDiscoveredPeers([]);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await startDiscovering();
        await startAdvertising();
      } else {
        const currentPeers = [...discoveredPeers];
        const userIds = currentPeers
          .filter(peer => peer.userId)
          .map(peer => peer.userId as string);

        if (userIds.length > 0) {
          await loadMultipleUserProfiles(userIds);
        }

        if (!isDiscovering) {
          await startDiscovering();
        }
        
        if (!isAdvertising) {
          await startAdvertising();
        }
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };
        
  // Handle send message
  const handleSendMessage = (profileId: string) => {
    console.log('Starting conversation with profileId:', profileId);
    const peer = discoveredPeers.find(p => p.peerId === profileId);
    if (peer) {
      console.log('Found peer to start conversation:', peer);
      startConversation(peer);
    } else {
      console.error('Could not find peer with ID:', profileId);
    }
  };
  
  const loadMultipleUserProfiles = async (userIds: string[]) => {
    if (!userIds || userIds.length === 0) return;
    
    try {
      const db = getDatabase();
      const profilePromises = userIds.map(userId => {
        const userProfileRef = ref(db, `profiles/${userId}`);
        return get(userProfileRef).then(snapshot => {
          if (snapshot.exists()) {
            return { userId, profile: snapshot.val() };
          }
          return { userId, profile: null };
        });
      });
      
      const profiles = await Promise.all(profilePromises);
      
      setDiscoveredPeers(prev => 
        prev.map(peer => {
          if (peer.userId) {
            const profileData = profiles.find(p => p.userId === peer.userId);
            if (profileData && profileData.profile) {
              return {
                ...peer,
                name: profileData.profile.firstName || peer.name,
                photoURL: profileData.profile.photoURL || peer.photoURL
              };
            }
          }
          return peer;
        })
      );
    } catch (error) {
      console.error('Error loading multiple user profiles:', error);
    }
  };

  const startConversation = (peer: Peer) => {
    if (!peer || !peer.peerId) {
      console.error('Invalid peer for conversation:', peer);
      return;
    }
    
    if (!userData) {
      console.error('Current user data not available');
      return;
    }
    
    console.log('Navigating to chat with:', peer.name, peer.peerId);
    
    // Create a unique conversation ID that will be consistent between the same two users
    // Sort the IDs to ensure the same conversation ID regardless of who initiates
    const participants = [userData.userId, peer.userId || peer.peerId].sort();
    const conversationId = `conv_${participants.join('_')}`;
    
    try {
      const db = getDatabase();
      const conversationRef = ref(db, `conversations/${conversationId}`);
      
      // Set or update the conversation data
      get(conversationRef).then(snapshot => {
        if (!snapshot.exists()) {
          // Create new conversation
          set(conversationRef, {
            initiatorId: userData.userId,
            receiverId: peer.userId || peer.peerId,
            createdAt: new Date().toISOString(),
            participants: {
              [userData.userId]: true,
              [peer.userId || peer.peerId]: true
            },
            lastActive: new Date().toISOString()
          });
        }
        
        // Always update profile info for the users
        const myProfileRef = ref(db, `profiles/${userData.userId}`);
        const peerProfileRef = ref(db, `profiles/${peer.userId || peer.peerId}`);
        
        // Try to get peer profile if it doesn't exist already
        get(peerProfileRef).then(peerSnapshot => {
          if (!peerSnapshot.exists() && peer.userId) {
            // Create a minimal profile for the peer if needed
            set(peerProfileRef, {
              firstName: peer.name || 'Anonymous',
              photoURL: peer.photoURL || null,
              lastActive: new Date().toISOString()
            });
          }
        });
        
        // Navigate to the chat screen
        router.push({
          pathname: '/chat/[id]',
          params: { 
            id: conversationId
          }
        });
      }).catch(error => {
        console.error('Error setting up conversation:', error);
      });
    } catch (error) {
      console.error('Error setting up conversation:', error);
    }
  };

  // Request permissions
  useEffect(() => {
    if (!libraryReady) return;
    
    const requestPermissions = async () => {
      try {
        const locationPerm = await Location.requestForegroundPermissionsAsync();
        if (locationPerm.status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Location permission is required to discover nearby users. Without this permission, you can still access your chats and profile.',
            [
              {
                text: 'OK',
                style: 'default'
              }
            ]
          );
          setErrorMessage('Location permission is required for nearby connections');
          return;
        }
        
        if (Platform.OS === 'ios') {
          try {
            const backgroundPerm = await Location.requestBackgroundPermissionsAsync();
            if (backgroundPerm.status !== 'granted') {
              console.log('Background location permission not granted');
          }
          } catch (locError) {
            console.error('Error requesting background location:', locError);
          }
        }
        
        if (Platform.OS === 'android') {
          try {
            const allPermissions = [
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
              'android.permission.BLUETOOTH_SCAN' as any,
              'android.permission.BLUETOOTH_CONNECT' as any,
              'android.permission.BLUETOOTH_ADVERTISE' as any,
              'android.permission.ACCESS_WIFI_STATE' as any,
              'android.permission.CHANGE_WIFI_STATE' as any,
              'android.permission.ACCESS_BACKGROUND_LOCATION' as any
            ];

            const granted = await PermissionsAndroid.requestMultiple(allPermissions);
            
            if (
              granted['android.permission.ACCESS_FINE_LOCATION'] !== 'granted' && 
              granted['android.permission.ACCESS_COARSE_LOCATION'] !== 'granted'
            ) {
              Alert.alert(
                'Location Permission',
                'Location permissions are required to discover nearby users. Without this permission, you can still access your chats and profile.',
                [
                  {
                    text: 'OK',
                    style: 'default'
                  }
                ]
              );
              setErrorMessage('Location permissions are required for nearby connections');
              return;
            }
          } catch (btError) {
            console.error('Error requesting Android permissions:', btError);
          }
        }
        
        setPermissionsGranted(true);
        updateUserLocation();
        } catch (error) {
        console.error('Error requesting permissions:', error);
        setErrorMessage('Failed to request necessary permissions');
      }
    };
    
    requestPermissions();
  }, [libraryReady]);

  // Start location tracking when permissions are granted
  useEffect(() => {
    if (!userData || !permissionsGranted || ghostMode) return;
    
    startLocationTracking();
    
    return () => {
      if (locationUpdateInterval.current) {
        clearInterval(locationUpdateInterval.current);
        locationUpdateInterval.current = null;
      }
    };
  }, [userData, permissionsGranted, ghostMode]);
  
  // Add a function to load a single user profile
  const loadUserProfile = async (userId: string) => {
    try {
      const db = getDatabase();
      const userProfileRef = ref(db, `profiles/${userId}`);
      const snapshot = await get(userProfileRef);
      
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        console.log('Loaded profile for user:', userId, profileData);
        
        setDiscoveredPeers(prev => 
          prev.map(peer => 
            peer.userId === userId 
              ? {
                  ...peer,
                  name: profileData.firstName || peer.name,
                  photoURL: profileData.photoURL || peer.photoURL
                }
              : peer
          )
        );
      } else {
        console.log('No profile data found for user:', userId);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Add a debug useEffect to monitor the state
  useEffect(() => {
    if (discoveredPeers.length > 0) {
      console.log('Current nearby users:', 
        discoveredPeers.map(p => ({
          peerId: p.peerId,
          name: p.name,
          userId: p.userId
        }))
      );
    }
  }, [discoveredPeers]);
  
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
  
  // Show better permissions screen if permissions are not granted
  if (!permissionsGranted) {
    return (
      <LinearGradient
        colors={['#f9f1e7', '#f9f1e7']}
        style={styles.container}
      >
        <View style={styles.permissionContainer}>
          <Ionicons name="location-outline" size={60} color="#222" style={styles.permissionIcon} />
          <Text style={styles.permissionTitle}>Location Permission Needed</Text>
          <Text style={styles.permissionText}>
            The Discover feature requires location permission to find nearby users.
          </Text>
          <Text style={styles.permissionDetail}>
            You can still access your chats and profile through the tabs below.
          </Text>
          <Text style={styles.permissionDetail}>
            Grant location permission to start discovering people around you.
          </Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="settings-outline" size={18} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#f9f1e7', '#f9f1e7']}
      style={styles.container}
    >
      <ProfileList 
        profiles={nearbyProfiles} 
        onSendMessage={handleSendMessage}
        onRefresh={handleRefresh}
        refreshing={refreshing}
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
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  profileDistance: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  refreshButton: {
    backgroundColor: '#f2f2f2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  refreshIcon: {
    marginRight: 8,
    color: '#666',
  },
  refreshButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionIcon: {
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  permissionText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 