import { useState, useEffect, useCallback } from 'react';
import { findNearbyUsers, updateLocation, getCurrentUser, getProfile } from '../lib/firebase';
import RNLocation, { Subscription, Location } from 'react-native-location';
import { Alert, Platform } from 'react-native';

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
  const [location, setLocation] = useState<Location | null>(null);
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
  const updateNearbyUsers = useCallback(async (userLocation: Location) => {
    try {
      // Generate some mock statuses
      const statuses = ['Open to chat', 'Chilling', 'Looking around', 'Just browsing'];

      // Fetch nearby users from Firebase
      const nearbyUsers = await findNearbyUsers(
        userLocation.latitude,
        userLocation.longitude,
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

  // Function to initialize location tracking
  const initializeLocationTracking = useCallback(async () => {
    // Configure the library
    RNLocation.configure({
      distanceFilter: 5, // Minimum distance in meters between location updates
      desiredAccuracy: {
        ios: 'best',
        android: 'balancedPowerAccuracy',
      },
      // Android-specific
      androidProvider: 'auto',
      interval: 5000, // Milliseconds between active location updates
      fastestInterval: 10000, // Milliseconds between location updates from all apps
      maxWaitTime: 15000, // Max time to wait for location in milliseconds

      // iOS-specific
      activityType: 'other',
      allowsBackgroundLocationUpdates: true, // Enable background location updates
      headingFilter: 1, // Minimum angular change in degrees for heading updates
      headingOrientation: 'portrait',
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    // Request permission
    let permissionGranted = false;

    try {
      permissionGranted = await RNLocation.requestPermission({
        ios: 'whenInUse', // or 'always' for background
        android: {
          detail: 'fine', // or 'coarse' for less precise
          rationale: {
            title: 'Location Permission',
            message: 'We need access to your location to find people nearby, even when the app is in the background.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        },
      });

      // Request background permission specifically for Android 10+ and iOS
      if (permissionGranted) {
        if (Platform.OS === 'android' && Platform.Version >= 29) {
          // For Android 10+ we need a special permission dialog
          Alert.alert(
            'Background Location Access',
            'ShyText needs your permission to access location in the background. This allows you to discover nearby users even when the app is closed.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  // This would typically open settings, but for simplicity we'll just request again
                  RNLocation.requestPermission({
                    android: {
                      detail: 'fine',
                      rationale: {
                        title: 'Background Location Permission',
                        message: 'We need background location access to find people nearby even when the app is closed.',
                        buttonPositive: 'OK',
                        buttonNegative: 'Cancel',
                      },
                    },
                  });
                },
              },
            ],
          );
        } else if (Platform.OS === 'ios') {
          // Request 'always' permission for iOS background tracking
          permissionGranted = await RNLocation.requestPermission({
            ios: 'always',
          });
        }
      }

      if (!permissionGranted) {
        setError('Location permission denied');
        setLoading(false);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      setError('Failed to request location permission');
      setLoading(false);
      return false;
    }
  }, []);

  // Function to manually refresh the list of nearby users
  const refreshUsers = useCallback(async () => {
    setError(null);
    
    try {
      await fetchCurrentUserProfile();
      
      if (!location) {
        // Configure and get permission
        const permissionGranted = await initializeLocationTracking();
        if (!permissionGranted) return false;
        
        // Get current location
        const currentLocation = await RNLocation.getLatestLocation({
          timeout: 10000,
        });
        
        if (currentLocation) {
          setLocation(currentLocation);
          
          // Update user location in Firebase
          const currentUser = getCurrentUser();
          if (currentUser) {
            await updateLocation(
              currentLocation.latitude,
              currentLocation.longitude
            );
          }
          
          await updateNearbyUsers(currentLocation);
        } else {
          setError('Could not get current location');
          return false;
        }
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
  }, [location, updateNearbyUsers, fetchCurrentUserProfile, initializeLocationTracking]);

  useEffect(() => {
    let locationSubscription: Subscription | null = null;

    async function setupLocationTracking() {
      try {
        // Configure and get permission
        const permissionGranted = await initializeLocationTracking();
        if (!permissionGranted) return;

        // Get initial location
        const initialLocation = await RNLocation.getLatestLocation({
          timeout: 10000,
        });

        if (initialLocation) {
          setLocation(initialLocation);

          // Fetch current user's profile
          await fetchCurrentUserProfile();

          // Update user location in Firebase
          const currentUser = getCurrentUser();
          if (currentUser) {
            await updateLocation(
              initialLocation.latitude,
              initialLocation.longitude
            );
          }

          // Subscribe to location updates
          locationSubscription = RNLocation.subscribeToLocationUpdates(async (locations) => {
            if (locations && locations.length > 0) {
              const newLocation = locations[0];
              setLocation(newLocation);
              
              // Update user location in Firebase
              const currentUser = getCurrentUser();
              if (currentUser) {
                updateLocation(
                  newLocation.latitude,
                  newLocation.longitude
                ).catch(console.error);
              }
              
              // Update nearby users
              updateNearbyUsers(newLocation).catch(console.error);
              fetchCurrentUserProfile().catch(console.error);
            }
          });

          // Initial fetch of nearby users
          await updateNearbyUsers(initialLocation);
        } else {
          setError('Could not get current location');
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup location');
        setLoading(false);
      }
    }

    setupLocationTracking();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription(); // Directly call the subscription function to unsubscribe
      }
    };
  }, [maxDistance, updateNearbyUsers, fetchCurrentUserProfile, initializeLocationTracking]);

  return {
    users,
    location,
    loading,
    error,
    currentUser: currentUserProfile,
    refreshUsers
  };
} 