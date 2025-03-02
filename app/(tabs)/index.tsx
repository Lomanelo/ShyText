import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useNearbyUsers } from '../../src/hooks/useNearbyUsers';
import { supabase, startConversation } from '../../src/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

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
        <div style={{ height: '100%', width: '100%' }}>
          <GoogleMapReact
            bootstrapURLKeys={{ key: '' }}
            defaultCenter={{
              lat: location.coords.latitude,
              lng: location.coords.longitude
            }}
            defaultZoom={19}
            options={{
              styles: [
                {
                  featureType: 'all',
                  elementType: 'all',
                  stylers: [{ saturation: -100 }]
                }
              ]
            }}
          >
            <MapMarker
              lat={location.coords.latitude}
              lng={location.coords.longitude}
              text="You"
              isUser
            />
            {nearbyUsers.map((user) => (
              <MapMarker
                key={user.id}
                lat={user.latitude}
                lng={user.longitude}
                text={user.first_name}
                onClick={() => onUserPress(user.id)}
              />
            ))}
          </GoogleMapReact>
        </div>
      );
    };
    return MapComponent;
  },
  default: () => () => null,
})();

// Separate native map implementation
const NativeMap = Platform.select({
  native: () => {
    const MapComponent = ({ location, nearbyUsers, onUserPress }: {
      location: Location.LocationObject;
      nearbyUsers: any[];
      onUserPress: (userId: string) => void;
    }) => {
      const { MapView, Marker } = require('react-native-maps');

      return (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          }}>
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You"
          />
          {nearbyUsers.map((user) => (
            <Marker
              key={user.id}
              coordinate={{
                latitude: user.latitude,
                longitude: user.longitude,
              }}
              title={user.first_name}
              onPress={() => onUserPress(user.id)}
            />
          ))}
        </MapView>
      );
    };
    return MapComponent;
  },
  default: () => () => null,
})();

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
      await startConversation(selectedUser.id, 'Hi! Would you like to chat?');
      router.push('/chats');
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

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <WebMap 
          location={location} 
          nearbyUsers={nearbyUsers}
          onUserPress={handleUserPress}
        />
      ) : (
        <NativeMap 
          location={location}
          nearbyUsers={nearbyUsers}
          onUserPress={handleUserPress}
        />
      )}
      
      {selectedUser && (
        <View style={styles.userCard}>
          <Text style={styles.userName}>{selectedUser.first_name}</Text>
          <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
            <LinearGradient
              colors={['#007AFF', '#0055FF']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
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