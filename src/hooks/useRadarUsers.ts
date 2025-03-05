import { useState, useEffect, useCallback } from 'react';
import { findNearbyUsers, updateLocation, getCurrentUser, getProfile } from '../lib/firebase';
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

interface CurrentUserProfile {
  id: string;
  photo_url?: string;
  display_name?: string;
}

export function useRadarUsers(maxDistance: number = 100) {
  const [users, setUsers] = useState<RadarUser[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);

  // Function to fetch current user's profile
  const fetchCurrentUserProfile = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      try {
        console.log('Fetching profile for current user:', currentUser.uid);
        const profile = await getProfile(currentUser.uid);
        console.log('Current user profile data:', profile);
        if (profile) {
          setCurrentUserProfile({
            id: currentUser.uid,
            photo_url: profile.photo_url,
            display_name: profile.display_name
          });
          console.log('Updated current user profile:', {
            id: currentUser.uid,
            photo_url: profile.photo_url,
            display_name: profile.display_name
          });
        } else {
          console.log('No profile found for current user');
        }
      } catch (err) {
        console.error('Error fetching current user profile:', err);
      }
    } else {
      console.log('No current user found');
    }
  }, []);

  // Function to update the list of nearby users
  const updateNearbyUsers = useCallback(async (userLocation: Location.LocationObject) => {
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
        // Ensure distance is a number
        distance: typeof user.distance === 'number' ? user.distance : 0,
      } as RadarUser));
      
      setUsers(processedUsers);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching nearby users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch nearby users');
      setLoading(false);
    }
  }, [maxDistance]);

  // Function to manually refresh the list of nearby users
  const refreshUsers = useCallback(async () => {
    setError(null);
    
    try {
      await fetchCurrentUserProfile();
      
      if (!location) {
        // Get current location if not available
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        setLocation(currentLocation);
        
        // Update user location in Firebase
        const currentUser = getCurrentUser();
        if (currentUser) {
          await updateLocation(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude
          );
        }
        
        await updateNearbyUsers(currentLocation);
      } else {
        // Use existing location
        await updateNearbyUsers(location);
      }
      
      return true;
    } catch (err) {
      console.error('Error refreshing users:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh nearby users');
      return false;
    }
  }, [location, updateNearbyUsers, fetchCurrentUserProfile]);

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

        // Fetch current user's profile
        await fetchCurrentUserProfile();

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
            fetchCurrentUserProfile().catch(console.error);
          }
        }, 10000); // Update every 10 seconds
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup location');
        setLoading(false);
      }
    }

    setupLocationTracking();

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (locationSubscription) locationSubscription.remove();
    };
  }, [maxDistance, updateNearbyUsers, fetchCurrentUserProfile]);

  return {
    users,
    location,
    loading,
    error,
    currentUser: currentUserProfile,
    refreshUsers
  };
} 