import { useState, useEffect } from 'react';
import { findNearbyUsers } from '../lib/firebase';
import * as Location from 'expo-location';

interface NearbyUser {
  id: string;
  distance: number;
  [key: string]: any;
}

export function useNearbyUsers() {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function updateNearbyUsers() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const nearbyUsers = await findNearbyUsers(
          location.coords.latitude,
          location.coords.longitude
        );
        
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
    };
  }, []);

  return { users, loading, error };
}