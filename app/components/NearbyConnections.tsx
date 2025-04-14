import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, Alert, Platform, PermissionsAndroid } from 'react-native';
import { Strategy } from 'expo-nearby-connections';
import { auth } from '../../src/lib/firebase';
import { getDatabase, ref, onValue } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

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
  
  // Safe start advertising with error handling
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
      
      const peerId = await NearbyConnections.startAdvertise(
        payload,
        Strategy.P2P_STAR
      );
      
      console.log('Advertising started, peerId:', peerId);
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
        senderName: userData?.displayName || 'Anonymous'
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
        
        // Skip if this is the current user based on userId or peerId
        if (peerIdentity.userId === userData?.userId) {
          console.log('Skipping self-discovery - exact userId match');
          return;
        }
        
        // Additional check for name similarity in case userId doesn't match
        if (peerIdentity.name === userData?.displayName) {
          console.log('Skipping self-discovery - name match');
          return;
        }
        
        // Update discovered peers with user data, with final self-check
        setDiscoveredPeers(prev => {
          // Check for existing entry to avoid duplicates
          const existing = prev.find(p => p.peerId === data.peerId);
          if (existing) return prev;
          
          // Final check to ensure we don't add ourselves
          if (data.peerId === myPeerId || peerIdentity.userId === userData?.userId) {
            console.log('Caught self-discovery in final check');
            return prev;
          }
          
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
          senderName
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
          <Text style={styles.userInfo}>
            Connected as: {userData.displayName}
          </Text>
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
        <Text style={styles.statusText}>
          {isAdvertising ? '✅ Visible to others' : '❌ Not visible to others'}
        </Text>
        <Text style={styles.statusText}>
          {isDiscovering ? '✅ Looking for people' : '❌ Not looking for people'}
        </Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nearby Users</Text>
        {discoveredPeers.length === 0 ? (
          <Text style={styles.emptyText}>No users found nearby yet. Please wait...</Text>
        ) : (
          <FlatList
            data={discoveredPeers}
            keyExtractor={(item, index) => `${item.peerId}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.peerItem}
                onPress={() => requestConnection(item.peerId)}>
                <View style={styles.peerInfo}>
                  <Text style={styles.peerName}>{item.name}</Text>
                  <Text style={styles.peerSubtext}>Tap to connect</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Users</Text>
        {connectedPeers.length === 0 ? (
          <Text style={styles.emptyText}>No connected users. Connect to someone nearby to chat.</Text>
        ) : (
          <FlatList
            data={connectedPeers}
            keyExtractor={(item, index) => `${item.peerId}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.connectedPeerItem}>
                <View style={styles.peerInfo}>
                  <Text style={styles.peerName}>{item.name}</Text>
                  <Text style={styles.peerSubtext}>Connected</Text>
                </View>
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
                <Text style={styles.messageSender}>{item.senderName || 'Unknown'}</Text>
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTimestamp}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#666"
            />
            {connectedPeers.map((peer) => (
              <TouchableOpacity
                key={peer.peerId}
                style={styles.sendButton}
                onPress={() => sendMessage(peer.peerId)}
                disabled={!messageText.trim()}>
                <LinearGradient
                  colors={['#007AFF', '#0055FF']}
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
    backgroundColor: '#1a1a1a',
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorTitle: {
    color: '#ff4040',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#ff4040',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  errorBannerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  errorBannerButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  headerSection: {
    marginBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  statusSection: {
    backgroundColor: '#272727',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
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
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
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
    marginBottom: 10,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  peerItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedPeerItem: {
    backgroundColor: '#1D4C7E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  messageItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageSender: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  messageTimestamp: {
    color: '#888',
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  sendButton: {
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
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