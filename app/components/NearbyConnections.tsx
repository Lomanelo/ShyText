import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, Alert, Platform, PermissionsAndroid, ScrollView } from 'react-native';
import { Strategy } from 'expo-nearby-connections';
import { auth } from '../../src/lib/firebase';
import { getDatabase, ref, onValue } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

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
}

interface Message {
  peerId: string;
  text: string;
  timestamp: number;
  senderName?: string;
  isSelf: boolean;
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
    
    const currentUser = auth.currentUser;
    if (currentUser) {
      const db = getDatabase();
      const userRef = ref(db, `users/${currentUser.uid}`);
      
      onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setUserData({
            userId: currentUser.uid,
            displayName: data.first_name || currentUser.displayName || 'Anonymous',
          });
        } else {
          setUserData({
            userId: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
          });
        }
      });
    }
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
      
      // Create a simple payload with user data
      // Using a simple string format to avoid JSON parsing issues
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
      
      // Create a simple payload with user data
      // Using a simple string format to avoid JSON parsing issues
      const payload = `${userData.userId}|${userData.displayName}`;
      
      console.log('Starting discovery with payload:', payload);
      
      const peerId = await NearbyConnections.startDiscovery(
        payload,
        Strategy.P2P_STAR
      );
      
      console.log('Discovery started, peerId:', peerId);
      setMyPeerId(peerId);
    } catch (error) {
      console.error('Error starting discovery:', error);
      setIsDiscovering(false);
      setErrorMessage('Could not search for nearby users');
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

  // Send message
  const sendMessage = async (peerId: string) => {
    if (!messageText.trim() || !NearbyConnections) return;
    
    try {
      // Create message with metadata (simple format)
      const messageWithMetadata = `${messageText}|${userData?.displayName || 'Anonymous'}|${Date.now()}`;
      
      await NearbyConnections.sendText(peerId, messageWithMetadata);
      
      // Add to local messages
      setMessages(prev => [...prev, { 
        peerId, 
        text: messageText,
        timestamp: Date.now(),
        senderName: userData?.displayName || 'Anonymous',
        isSelf: true
      }]);
      
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage('Could not send message');
    }
  };

  // Parse peer identity from the advertised/discovery name
  const parsePeerIdentity = (name: string): Peer => {
    try {
      // Try to parse as pipe-delimited string: userId|displayName
      const parts = name.split('|');
      if (parts.length >= 2) {
        return {
          peerId: '',
          name: parts[1] || 'Unknown',
          userId: parts[0] || '',
        };
      }
      
      // Try to parse JSON data as fallback
      try {
        const userData = JSON.parse(name);
        return {
          peerId: userData.peerId || '',
          name: userData.name || 'Unknown',
          userId: userData.userId || '',
        };
      } catch (jsonError) {
        // If not JSON or pipe-delimited, use as-is
        return {
          peerId: '',
          name: name || 'Unknown'
        };
      }
    } catch (e) {
      // If any error occurs, use as-is
      return {
        peerId: '',
        name: name || 'Unknown'
      };
    }
  };

  // Parse message text
  const parseMessageText = (text: string): { text: string; senderName: string; timestamp: number } => {
    try {
      // Try to parse as pipe-delimited string: text|senderName|timestamp
      const parts = text.split('|');
      if (parts.length >= 3) {
        return {
          text: parts[0] || '',
          senderName: parts[1] || 'Unknown',
          timestamp: parseInt(parts[2]) || Date.now()
        };
      }
      
      // Try to parse JSON data as fallback
      try {
        const messageData = JSON.parse(text);
        return {
          text: messageData.text || text,
          senderName: messageData.senderName || 'Unknown',
          timestamp: messageData.timestamp || Date.now()
        };
      } catch (jsonError) {
        // If not JSON or pipe-delimited, use as-is
        return {
          text,
          senderName: 'Unknown',
          timestamp: Date.now()
        };
      }
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
        console.log('Parsed peer identity:', peerIdentity, 'My userData:', userData);
        
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
        
        // Update discovered peers with user data, with more robust duplicate and self checks
        setDiscoveredPeers(prev => {
          // First check if we already have this peer by peerId
          const existingByPeerId = prev.find(p => p.peerId === data.peerId);
          if (existingByPeerId) {
            console.log('Skipping duplicate peer (by peerId)');
            return prev;
          }
          
          // Then check if we already have this peer by userId (more reliable)
          const existingByUserId = peerIdentity.userId && 
                                   prev.find(p => p.userId === peerIdentity.userId);
          if (existingByUserId) {
            console.log('Removing older instance of same user (by userId)');
            // Replace the old entry with the new one (fresher data)
            return prev
              .filter(p => p.userId !== peerIdentity.userId)
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
        
        setMessages(prev => [...prev, { 
          peerId: data.peerId, 
          text: messageText,
          timestamp,
          senderName,
          isSelf: false
        }]);
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

  // Add a more aggressive deduplication effect
  useEffect(() => {
    if (!discoveredPeers.length) return;
    
    // Deduplicate peers by their userIds (most reliable)
    const uniqueUserIds = new Set();
    const deduplicatedPeers = [];
    
    for (const peer of discoveredPeers) {
      if (peer.userId) {
        // If the peer has a userId, use that for deduplication
        if (!uniqueUserIds.has(peer.userId)) {
          uniqueUserIds.add(peer.userId);
          deduplicatedPeers.push(peer);
        }
      } else {
        // If no userId, use peerId as fallback
        if (!uniqueUserIds.has(peer.peerId)) {
          uniqueUserIds.add(peer.peerId);
          deduplicatedPeers.push(peer);
        }
      }
    }
    
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
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.errorBannerButton}
            onPress={() => setErrorMessage(null)}
          >
            <Text style={styles.errorBannerButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <LinearGradient
        colors={['#121212', '#1E2836']}
        style={styles.gradientBackground}
      >
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Nearby Connections</Text>
          {userData ? (
            <Text style={styles.userInfo}>
              Connected as: {userData.displayName}
            </Text>
          ) : null}
        </View>

        <View style={styles.statusCardContainer}>
          <LinearGradient
            colors={['#1E293B', '#334155']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusCard}
          >
            <View style={styles.statusContent}>
              <View style={styles.statusIconContainer}>
                <View style={[styles.statusIndicator, isAdvertising && styles.activeIndicator]} />
                <Ionicons name="wifi" size={22} color="#fff" style={styles.statusIcon} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Broadcasting</Text>
                <Text style={styles.statusValue}>{isAdvertising ? 'Active' : 'Inactive'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, isAdvertising && styles.actionButtonActive]}
                onPress={() => isAdvertising ? stopAdvertising() : handleStartAdvertising()}
              >
                <Text style={styles.actionButtonText}>
                  {isAdvertising ? 'Stop' : 'Start'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['#1E293B', '#334155']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusCard}
          >
            <View style={styles.statusContent}>
              <View style={styles.statusIconContainer}>
                <View style={[styles.statusIndicator, isDiscovering && styles.activeIndicator]} />
                <Ionicons name="search" size={22} color="#fff" style={styles.statusIcon} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Discovering</Text>
                <Text style={styles.statusValue}>{isDiscovering ? 'Active' : 'Inactive'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, isDiscovering && styles.actionButtonActive]}
                onPress={() => isDiscovering ? stopDiscovering() : handleStartDiscovery()}
              >
                <Text style={styles.actionButtonText}>
                  {isDiscovering ? 'Stop' : 'Start'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.sectionTitle}>
            People Nearby ({discoveredPeers.length})
          </Text>
          
          {discoveredPeers.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="people" size={50} color="#4285F4" style={styles.emptyStateIcon} />
              <Text style={styles.emptyText}>
                {isDiscovering ? "Searching for people nearby..." : "Start discovering to find people around you"}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.peersList}>
              {discoveredPeers.map((peer) => {
                const isConnected = connectedPeers.some(
                  (p) => p.peerId === peer.peerId
                );
                return (
                  <TouchableOpacity
                    key={peer.peerId}
                    onPress={() => !isConnected && requestConnection(peer.peerId)}
                  >
                    <LinearGradient
                      colors={isConnected ? ['#214D76', '#1D4C7E'] : ['#292D3E', '#3A3F55']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.peerItem, isConnected && styles.connectedPeerItemGradient]}
                    >
                      <View style={styles.peerAvatarContainer}>
                        <Text style={styles.peerAvatar}>
                          {peer.name ? peer.name.charAt(0).toUpperCase() : "?"}
                        </Text>
                      </View>
                      <View style={styles.peerInfo}>
                        <Text style={styles.peerName}>{peer.name || 'Unknown'}</Text>
                        <Text style={styles.peerSubtext}>
                          {isConnected ? 'Connected' : 'Tap to connect'}
                        </Text>
                      </View>
                      <View style={styles.peerStatusIndicator}>
                        <Ionicons 
                          name={isConnected ? "checkmark-circle" : "arrow-forward-circle"} 
                          size={24} 
                          color={isConnected ? "#4ECCA3" : "#4285F4"} 
                        />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {connectedPeers.length > 0 && (
            <View style={styles.chatSection}>
              <Text style={styles.sectionTitle}>Messages</Text>
              <ScrollView style={styles.messagesList}>
                {messages.map((message, index) => (
                  <LinearGradient
                    key={index}
                    colors={message.isSelf ? ['#4285F4', '#3367D6'] : ['#292D3E', '#3A3F55']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.messageItem,
                      message.isSelf ? styles.sentMessage : styles.receivedMessage,
                    ]}
                  >
                    <Text style={styles.messageSender}>
                      {message.isSelf
                        ? 'You'
                        : connectedPeers.find((p) => p.peerId === message.peerId)
                            ?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.messageText}>{message.text}</Text>
                    <Text style={styles.messageTimestamp}>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </LinearGradient>
                ))}
              </ScrollView>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor="#aaa"
                  value={messageText}
                  onChangeText={setMessageText}
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={() => connectedPeers.length > 0 ? sendMessage(connectedPeers[0].peerId) : null}
                  disabled={!messageText.trim() || !connectedPeers.length}
                >
                  <LinearGradient
                    colors={['#4285F4', '#3367D6']}
                    style={styles.sendButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.sendButtonText}>Send</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradientBackground: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorTitle: {
    color: '#ff5252',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetail: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 82, 82, 0.9)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    margin: 16,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  errorBannerButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  errorBannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  headerSection: {
    marginBottom: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  userInfo: {
    color: '#bbb',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
  },
  statusCardContainer: {
    marginBottom: 24,
  },
  statusCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
  },
  statusIndicator: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#777',
    top: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#121212',
  },
  activeIndicator: {
    backgroundColor: '#4ECCA3',
  },
  statusIcon: {
    opacity: 0.9,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusValue: {
    color: '#bbb',
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderColor: '#ff5252',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 20,
    lineHeight: 22,
  },
  peersList: {
    marginBottom: 20,
  },
  peerItem: {
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  connectedPeerItemGradient: {
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.5)',
  },
  peerAvatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 12,
  },
  peerAvatar: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  peerInfo: {
    flex: 1,
    paddingVertical: 16,
  },
  peerName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  peerSubtext: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  peerStatusIndicator: {
    paddingRight: 16,
  },
  chatSection: {
    flex: 1,
    marginTop: 20,
  },
  messagesList: {
    maxHeight: 250,
    marginBottom: 10,
  },
  messageItem: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 6,
    lineHeight: 22,
  },
  messageTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'column',
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(30, 30, 40, 0.8)',
    borderRadius: 20,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(80, 80, 80, 0.5)',
  },
  sendButton: {
    height: 45,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
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
    letterSpacing: 0.5,
  },
}); 