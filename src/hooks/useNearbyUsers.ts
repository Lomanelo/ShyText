import { useState, useEffect, useCallback } from 'react';
import { Device } from 'react-native-ble-plx';
import { getProfile, getCurrentUser, listAllUsers } from '../lib/firebase';
import BleService from '../services/BleService';
import { Platform } from 'react-native';

interface NearbyUser {
  id: string;
  display_name?: string;
  photo_url?: string;
  status?: string;
  lastActive?: string;
  deviceId?: string;
  rssi?: number;
  distance?: number; // Add distance in meters
  [key: string]: any;
}

interface FirebaseUser {
  id: string;
  display_name?: string;
  photo_url?: string;
  status?: string;
  last_active?: string;
  [key: string]: any;
}

// Store discovered devices in memory
let discoveredDevices: {[key: string]: {device: Device, timestamp: number}} = {};

// Cache of users to avoid repeated Firebase calls
let usersCache: {[key: string]: any} = {};

// Maximum time (in ms) that a device can remain in the list without being rediscovered
const DEVICE_TIMEOUT = 5000; // 5 seconds

// RSSI cutoff value (approximating 5 meters)
const RSSI_CUTOFF = -70; // Around 5 meters

// Convert RSSI to approximate distance in meters
const rssiToDistance = (rssi: number): number => {
  // A simple model: assuming -40 is about 1m and signal loses 20dB when distance doubles
  const referenceRssi = -40; // RSSI at 1 meter
  const pathLossFactor = 2.0; // Signal strength drops with square of distance
  
  // Calculation based on log-distance path loss model
  return Math.round(Math.pow(10, (referenceRssi - rssi) / (10 * pathLossFactor)));
};

// Simple wrapper functions for BleService
export const startScanning = async () => {
  const bleService = BleService.getInstance();
  try {
    // We ignore the device found callback since we handle that in the hook
    return await bleService.startScanning(() => {});
  } catch (error) {
    console.error('Error starting scanning from exported function:', error);
    return false;
  }
};

export const stopScanning = () => {
  const bleService = BleService.getInstance();
  try {
    bleService.stopScanning();
  } catch (error) {
    console.error('Error stopping scanning from exported function:', error);
  }
};

export function useNearbyUsers() {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [btEnabled, setBtEnabled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // Function to get all users from Firebase
  const fetchAllUsers = useCallback(async () => {
    try {
      const allUsers = await listAllUsers();
      console.log(`Fetched ${allUsers.length} users from Firebase`);
      
      // Cache users to avoid repeated Firebase calls
      allUsers.forEach((user: FirebaseUser) => {
        usersCache[user.id] = user;
      });
      
      setAllUsers(allUsers);
      return allUsers;
    } catch (err) {
      console.error('Error fetching all users:', err);
      return [];
    }
  }, []);

  // Function to get device info
  const getDeviceInfo = useCallback(async () => {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        isSimulator: Platform.OS === 'ios' && (__DEV__ ? true : false),
        timestamp: new Date().toISOString(),
      };
      console.log('Device info:', deviceInfo);
      setDeviceInfo(deviceInfo);
      return deviceInfo;
    } catch (error) {
      console.error('Error getting device info:', error);
      return null;
    }
  }, []);

  // Function to update the users list based on discovered devices
  const updateUsersList = useCallback(() => {
    const currentTime = Date.now();
    const validDeviceIds: string[] = [];
    let hasRemovedDevices = false;
    
    // Filter out stale devices and devices outside the range
    Object.keys(discoveredDevices).forEach(deviceId => {
      const deviceData = discoveredDevices[deviceId];
      
      // Remove devices that haven't been seen recently
      if (currentTime - deviceData.timestamp > DEVICE_TIMEOUT) {
        console.log(`Removing stale device: ${deviceId}, last seen ${(currentTime - deviceData.timestamp)/1000}s ago`);
        delete discoveredDevices[deviceId];
        hasRemovedDevices = true;
        return;
      }
      
      // Check if the device is within range (using RSSI as proxy)
      const rssi = deviceData.device.rssi || -100;
      if (rssi < RSSI_CUTOFF) {
        console.log(`Device ${deviceId} is out of range (RSSI: ${rssi})`);
        return;
      }
      
      validDeviceIds.push(deviceId);
    });
    
    // Update the users list based on the current valid devices
    setUsers(prevUsers => {
      // Filter out users whose devices are no longer valid
      const newUsers = prevUsers.filter(user => 
        user.deviceId && validDeviceIds.includes(user.deviceId)
      );
      
      // If we removed some users, log it
      if (newUsers.length !== prevUsers.length) {
        console.log(`Removed ${prevUsers.length - newUsers.length} users from radar due to stale/out of range devices`);
      }
      
      // Return the updated list
      return newUsers;
    });
    
    return hasRemovedDevices;
  }, []);

  // Set up a more aggressive timer to update the users list
  useEffect(() => {
    if (isScanning) {
      // Run the update more frequently - every 1 second instead of 2 seconds
      const intervalId = setInterval(updateUsersList, 1000);
      return () => clearInterval(intervalId);
    }
  }, [isScanning, updateUsersList]);

  // Function to handle found devices - now matches against UUIDs instead of names
  const handleDeviceFound = useCallback(async (device: Device) => {
    try {
      // Skip devices with very weak signals (likely too far away)
      if (device.rssi && device.rssi < RSSI_CUTOFF) {
        return;
      }
      
      // Update the device in our cache with current timestamp
      discoveredDevices[device.id] = {
        device,
        timestamp: Date.now()
      };
      
      // Calculate approximate distance
      const distance = device.rssi ? rssiToDistance(device.rssi) : Infinity;
      
      // Log processing with distance info
      console.log(`Processing device: ${device.id}, Name: ${device.name || device.localName || 'unnamed'}, RSSI: ${device.rssi}, ~${distance}m`);
      
      // Check if we already have this device mapped to a user
      const existingUser = users.find(user => user.deviceId === device.id);
      if (existingUser) {
        // Update the user's distance and last active time
        setUsers(prevUsers => prevUsers.map(user => {
          if (user.deviceId === device.id) {
            return {
              ...user,
              rssi: device.rssi || undefined,
              distance: distance,
              lastActive: new Date().toISOString()
            };
          }
          return user;
        }));
        return;
      }
      
      // If we don't have users loaded yet, fetch them now
      let usersList = allUsers;
      if (usersList.length === 0) {
        usersList = await fetchAllUsers();
      }
      
      // Try to match the device by UUID using the device identifier
      // We'll try multiple approaches since device IDs can vary by platform
      try {
        // 1. First try direct device.id match
        const { getUserByDeviceUUID } = require('../lib/firebase');
        
        // Try to find a user with this device ID
        const matchedUser = await getUserByDeviceUUID(device.id);
        
        if (matchedUser) {
          console.log(`Found user with matching device UUID: ${matchedUser.display_name}`);
          
          // Check if we already have this user in our list
          if (users.some(user => user.id === matchedUser.id)) {
            console.log('User already in nearby list:', matchedUser.display_name);
            return;
          }
          
          // Add the user to our list with device info
          setUsers(prevUsers => [...prevUsers, {
            ...matchedUser,
            deviceId: device.id,
            rssi: device.rssi,
            distance: distance,
            lastActive: new Date().toISOString()
          }]);
          return;
        }
        
        // 2. Try with platform prefixes
        const platformId = `${Platform.OS}-${device.id}`;
        const matchedUserWithPlatform = await getUserByDeviceUUID(platformId);
        
        if (matchedUserWithPlatform) {
          console.log(`Found user with platform-prefixed UUID: ${matchedUserWithPlatform.display_name}`);
          
          // Check if we already have this user in our list
          if (users.some(user => user.id === matchedUserWithPlatform.id)) {
            console.log('User already in nearby list:', matchedUserWithPlatform.display_name);
            return;
          }
          
          // Add the user to our list with device info
          setUsers(prevUsers => [...prevUsers, {
            ...matchedUserWithPlatform,
            deviceId: device.id,
            rssi: device.rssi,
            distance: distance,
            lastActive: new Date().toISOString()
          }]);
          return;
        }
        
        // 3. Try variations of the device ID
        // Some devices report UUIDs in different formats
        const normalizedId = device.id.replace(/[-:]/g, '').toLowerCase();
        const matchedUserNormalized = await getUserByDeviceUUID(normalizedId);
        
        if (matchedUserNormalized) {
          console.log(`Found user with normalized UUID: ${matchedUserNormalized.display_name}`);
          
          // Check if we already have this user in our list
          if (users.some(user => user.id === matchedUserNormalized.id)) {
            console.log('User already in nearby list:', matchedUserNormalized.display_name);
            return;
          }
          
          // Add the user to our list with device info
          setUsers(prevUsers => [...prevUsers, {
            ...matchedUserNormalized,
            deviceId: device.id,
            rssi: device.rssi,
            distance: distance,
            lastActive: new Date().toISOString()
          }]);
          return;
        }
      } catch (err) {
        console.error('Error looking up user by device UUID:', err);
      }
      
      console.log('No matching user found for device:', device.id);
    } catch (err) {
      console.error('Error processing found device:', err);
    }
  }, [allUsers, users, fetchAllUsers]);

  // Initialize BLE and fetch users on component mount
  useEffect(() => {
    const initializeBLE = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get device info
        await getDeviceInfo();
        
        // Fetch all users
        await fetchAllUsers();
        
        // Initialize BleService
        const bleService = BleService.getInstance();
        const initialized = await bleService.initialize();
        console.log('BLE initialization result:', initialized);
        setBtEnabled(initialized);
        
        if (initialized) {
          setLoading(false);
        } else {
          setError('Bluetooth is not enabled. Please enable Bluetooth to discover nearby users.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize BLE:', err);
        setError('Failed to initialize Bluetooth. Please try again.');
        setLoading(false);
      }
    };
    
    initializeBLE();
    
    // Cleanup
    return () => {
      const bleService = BleService.getInstance();
      bleService.cleanUp();
    };
  }, [getDeviceInfo, fetchAllUsers]);

  // Function to start scanning for devices
  const startScanningForDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsScanning(true);
      
      const bleService = BleService.getInstance();
      console.log('Starting BLE scanning from hook...');
      const success = await bleService.startScanning(handleDeviceFound);
      
      if (success) {
        console.log('BLE scanning started successfully');
        // Also start advertising our presence (Android only)
        if (Platform.OS === 'android') {
          const advResult = await bleService.startAdvertising();
          console.log('Advertising result:', advResult);
        }
      } else {
        setError('Could not start scanning. Please ensure Bluetooth is enabled.');
        setIsScanning(false);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error in startScanningForDevices:', err);
      setError('Failed to start scanning. Please try again.');
      setLoading(false);
      setIsScanning(false);
    }
  }, [handleDeviceFound]);

  // Function to stop scanning and advertising
  const stopScanningAndAdvertising = useCallback(() => {
    try {
      const bleService = BleService.getInstance();
      bleService.stopScanning();
      bleService.stopAdvertising();
      setIsScanning(false);
    } catch (err) {
      console.error('Error stopping scanning:', err);
    }
  }, []);

  // Modify the refresh function to do a deep clean
  const refreshUsers = useCallback(async () => {
    try {
      console.log('Refreshing users and clearing all discovered devices...');
      
      // Clear existing users
      setUsers([]);
      
      // Clear all discovered devices
      discoveredDevices = {};
      
      // Refresh the user list
      await fetchAllUsers();
      
      // Stop scanning if active
      const bleService = BleService.getInstance();
      bleService.stopScanning();
      setIsScanning(false);
      
      // Short delay to ensure scanning is completely stopped
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start scanning again
      await startScanningForDevices();
    } catch (err) {
      console.error('Failed to refresh users:', err);
      setError('Failed to refresh users. Please try again.');
    }
  }, [startScanningForDevices, fetchAllUsers]);

  return {
    users,
    loading,
    error,
    isScanning,
    btEnabled,
    deviceInfo,
    allUsers,
    refreshUsers,
    startScanning: startScanningForDevices,
    stopScanning: stopScanningAndAdvertising,
    setUsers  // Expose setUsers for direct manipulation in force refresh
  };
}