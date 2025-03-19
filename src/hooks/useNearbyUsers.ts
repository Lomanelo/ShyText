import { useState, useEffect, useCallback } from 'react';
import { Device } from 'react-native-ble-plx';
import { getProfile } from '../lib/firebase';
import BleService from '../services/BleService';

interface NearbyUser {
  id: string;
  display_name?: string;
  photo_url?: string;
  status?: string;
  lastActive?: string;
  [key: string]: any;
}

export function useNearbyUsers() {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Function to handle found devices
  const handleDeviceFound = useCallback(async (device: Device) => {
    try {
      // Extract user ID from device name (format: ShyText_userId)
      const userId = device.name?.split('_')[1];
      if (!userId) return;

      // Check if we already have this user
      if (users.some(user => user.id === userId)) {
        return;
      }

      // Fetch user profile from Firebase
      const profile = await getProfile(userId);
      if (profile) {
        setUsers(prevUsers => [...prevUsers, {
          id: userId,
          display_name: profile.display_name,
          photo_url: profile.photo_url,
          status: profile.status || 'Available',
          lastActive: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Error processing found device:', err);
    }
  }, [users]);

  // Function to start scanning
  const startScanning = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsScanning(true);
      
      const bleService = BleService.getInstance();
      bleService.startScanning(handleDeviceFound);
      
      // Start advertising our presence
      await bleService.startAdvertising();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanning');
      setLoading(false);
    }
  }, [handleDeviceFound]);

  // Function to stop scanning
  const stopScanning = useCallback(async () => {
    try {
      const bleService = BleService.getInstance();
      bleService.stopScanning();
      await bleService.stopAdvertising();
      setIsScanning(false);
      setLoading(false);
    } catch (err) {
      console.error('Error stopping scan:', err);
    }
  }, []);

  // Start scanning when component mounts
  useEffect(() => {
    startScanning();

    // Cleanup
    return () => {
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  // Function to refresh the list of nearby users
  const refreshUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setUsers([]); // Clear existing users
      await startScanning();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh users');
      setLoading(false);
    }
  }, [startScanning]);

  return {
    users,
    loading,
    error,
    isScanning,
    refreshUsers,
    startScanning,
    stopScanning
  };
}