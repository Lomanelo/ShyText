import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useNearbyUsers } from '../../src/hooks/useNearbyUsers';
import { LinearGradient } from 'expo-linear-gradient';
import { getDatabase, ref, push, set } from 'firebase/database';
import { auth } from '../../src/lib/firebase';

// Firebase function to start a conversation
async function startConversation(otherUserId: string, initialMessage: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('You must be logged in');

  const db = getDatabase();
  const conversationsRef = ref(db, 'conversations');
  
  // Create a new conversation
  const newConversationRef = push(conversationsRef);
  const conversationId = newConversationRef.key;
  
  if (!conversationId) throw new Error('Failed to create conversation');
  
  // Set conversation data
  await set(newConversationRef, {
    initiatorId: currentUser.uid,
    receiverId: otherUserId,
    createdAt: new Date().toISOString(),
    // Create a participants object for easy querying
    participants: {
      [currentUser.uid]: true,
      [otherUserId]: true
    }
  });
  
  // Add initial message
  const messagesRef = ref(db, `messages/${conversationId}`);
  const newMessageRef = push(messagesRef);
  
  await set(newMessageRef, {
    senderId: currentUser.uid,
    content: initialMessage,
    createdAt: new Date().toISOString()
  });
  
  return conversationId;
}

// Lazy load platform-specific components
const WebMap = Platform.select({
  web: () => {
    const MapComponent = ({ location, nearbyUsers, onUserPress }: { 
      location: Location.LocationObject;
      nearbyUsers: any[];
      onUserPress: (userId: string) => void;
    }) => {
      const GoogleMapReact = require('google-map-react').default;

      const MapMarker = ({ text, isUser, onClick }: { 
        text: string;
        isUser?: boolean;
        onClick?: () => void;
      }) => (
        <div 
          onClick={onClick}
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            background: isUser ? '#1a1a1a' : '#007AFF',
            padding: '8px 16px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            cursor: onClick ? 'pointer' : 'default'
          }}>
          {text}
        </div>
      );

      return (
        <GoogleMapReact
          bootstrapURLKeys={{ key: 'YOUR_GOOGLE_MAPS_API_KEY' }}
          defaultCenter={{
            lat: location.coords.latitude,
            lng: location.coords.longitude
          }}
          defaultZoom={15}
          style={{ width: '100%', height: '100%' }}
        >
          <MapMarker
            lat={location.coords.latitude}
            lng={location.coords.longitude}
            text="You"
            isUser
          />
          
          {nearbyUsers.map(user => (
            <MapMarker
              key={user.id}
              lat={user.latitude}
              lng={user.longitude}
              text={user.firstName || 'User'}
              onClick={() => onUserPress(user.id)}
            />
          ))}
        </GoogleMapReact>
      );
    };

    return MapComponent;
  },
  default: null
});

// Native map for iOS/Android
const NativeMap = Platform.select({
  native: () => {
    const MapView = require('react-native-maps').default;
    const { Marker } = require('react-native-maps');

    const MapComponent = ({ location, nearbyUsers, onUserPress }: { 
      location: Location.LocationObject;
      nearbyUsers: any[];
      onUserPress: (userId: string) => void;
    }) => (
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      >
        {nearbyUsers.map(user => (
          <Marker
            key={user.id}
            coordinate={{
              latitude: user.latitude,
              longitude: user.longitude,
            }}
            title={user.firstName || 'User'}
            onPress={() => onUserPress(user.id)}
          />
        ))}
      </MapView>
    );

    return MapComponent;
  },
  default: null
});

export default function NearbyScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const { users: nearbyUsers, loading, error } = useNearbyUsers();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const handleUserPress = (userId: string) => {
    const user = nearbyUsers.find(u => u.id === userId);
    setSelectedUser(user);
  };

  const handleStartChat = async () => {
    if (!selectedUser) return;
    
    try {
      const conversationId = await startConversation(selectedUser.id, 'Hi! Would you like to chat?');
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
    
    setSelectedUser(null);
  };

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location || loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const Map = Platform.OS === 'web' ? WebMap : NativeMap;

  return (
    <View style={styles.container}>
      {Map && <Map 
        location={location} 
        nearbyUsers={nearbyUsers}
        onUserPress={handleUserPress}
      />}
      
      {selectedUser && (
        <View style={styles.userCard}>
          <Text style={styles.userName}>{selectedUser.firstName}</Text>
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={handleStartChat}
          >
            <LinearGradient
              colors={['#007AFF', '#0055FF']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.chatButtonText}>Start Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  map: {
    flex: 1,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  userCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chatButton: {
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});