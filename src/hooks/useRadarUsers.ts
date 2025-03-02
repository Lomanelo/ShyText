import { useState, useEffect } from 'react';
import { findNearbyUsers, updateLocation, getCurrentUser } from '../lib/firebase';
import * as Location from 'expo-location';

interface RadarUser {
  id: string;
  distance: number; // in meters
  display_name?: string;
  photo_url?: string;
  status?: string;
  lastActive?: string;
  [key: string]: any;
}

export function useRadarUsers(maxDistance: number = 100) {
  const [users, setUsers] = useState<RadarUser[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let locationSubscription: Location.LocationSubscription;

    async function setupLocationTracking() {
      try {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          setLoading(false);
          return;
        }

        // Get initial location
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        setLocation(initialLocation);

        // Update user location in Firebase
        const currentUser = getCurrentUser();
        if (currentUser) {
          await updateLocation(
            initialLocation.coords.latitude,
            initialLocation.coords.longitude
          );
        }

        // Subscribe to location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 5, // Update when moved 5 meters
            timeInterval: 10000, // Or every 10 seconds
          },
          (newLocation) => {
            setLocation(newLocation);
            
            // Update user location in Firebase (throttled)
            if (currentUser) {
              updateLocation(
                newLocation.coords.latitude,
                newLocation.coords.longitude
              ).catch(console.error);
            }
          }
        );

        // Initial fetch of nearby users
        await updateNearbyUsers(initialLocation);
        
        // Setup interval for periodic updates
        intervalId = setInterval(() => {
          if (location) {
            updateNearbyUsers(location).catch(console.error);
          }
        }, 10000); // Update every 10 seconds
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup location');
        setLoading(false);
      }
    }

    async function updateNearbyUsers(userLocation: Location.LocationObject) {
      try {
        // Generate some mock statuses
        const statuses = ['Open to chat', 'Chilling', 'Looking around', 'Just browsing'];

        // Fetch nearby users from Firebase
        const nearbyUsers = await findNearbyUsers(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          maxDistance / 1000 // Convert meters to km
        );
        
        // Process the users
        const processedUsers = nearbyUsers.map(user => ({
          ...user,
          // Assign a random status if not present
          status: user.status || statuses[Math.floor(Math.random() * statuses.length)],
          // Format distance to be in meters (it comes back in km)
          distance: user.distance || 0,
        }));
        
        setUsers(processedUsers);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching nearby users:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch nearby users');
        setLoading(false);
      }
    }

    setupLocationTracking();

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (locationSubscription) locationSubscription.remove();
    };
  }, [maxDistance]);

  return {
    users,
    location,
    loading,
    error,
    currentUser: getCurrentUser(),
  };
} 