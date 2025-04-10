import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { getDatabase, ref, query, orderByChild, onValue, get } from 'firebase/database';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { auth } from '../lib/firebase';

// Distance in kilometers
const RADIUS_KM = 5;

// Define user type
interface NearbyUser {
  id: string;
  firstName: string;
  email?: string;
  photoURL?: string | null;
  distance: number;
  [key: string]: any;
}

export function useNearbyUsers() {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let locationSubscription: any;

    async function updateNearbyUsers() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        
        // Update current user's location in Firebase
        if (auth.currentUser) {
          const db = getDatabase();
          const userLocationRef = ref(db, `user_locations/${auth.currentUser.uid}`);
          await updateUserLocation(userLocationRef, latitude, longitude);
        }
        
        // Find nearby users
        const nearbyUsers = await findNearbyUsers(latitude, longitude);
        setUsers(nearbyUsers);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    }

    // Update immediately and then every 30 seconds
    updateNearbyUsers();
    intervalId = setInterval(updateNearbyUsers, 30000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  const updateUserLocation = async (locationRef: any, latitude: number, longitude: number) => {
    const db = getDatabase();
    const updates = {
      latitude,
      longitude,
      lastUpdated: new Date().toISOString()
    };
    await locationRef.set(updates);
  };

  const findNearbyUsers = async (latitude: number, longitude: number): Promise<NearbyUser[]> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const db = getDatabase();
    const locationsRef = ref(db, 'user_locations');
    
    // Get all user locations
    const snapshot = await get(locationsRef);
    if (!snapshot.exists()) return [];
    
    const allLocations = snapshot.val();
    const nearbyUsers: NearbyUser[] = [];
    
    // Filter users within radius
    for (const userId in allLocations) {
      // Skip current user
      if (userId === currentUser.uid) continue;
      
      const userLoc = allLocations[userId];
      const distance = distanceBetween(
        [latitude, longitude],
        [userLoc.latitude, userLoc.longitude]
      );
      
      // If within radius, get user profile
      if (distance <= RADIUS_KM) {
        // Get user profile data
        const userProfileRef = ref(db, `profiles/${userId}`);
        const profileSnapshot = await get(userProfileRef);
        
        if (profileSnapshot.exists()) {
          const profile = profileSnapshot.val();
          nearbyUsers.push({
            id: userId,
            ...profile,
            distance: Math.round(distance * 100) / 100
          });
        }
      }
    }
    
    // Sort by distance
    return nearbyUsers.sort((a, b) => a.distance - b.distance);
  };

  return { users, loading, error };
}