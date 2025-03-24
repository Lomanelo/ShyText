import { useState, useEffect, useCallback } from 'react';
import { Device } from 'react-native-ble-plx';
import { 
  getProfile, 
  getCurrentUser, 
  listAllUsers, 
  verifyUserByMacAddress, 
  isUserVerified,
  storeDiscoveredDeviceId
} from '../lib/firebase';
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
  const [isAuthorized, setIsAuthorized] = useState(true);
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

  // Function to handle found devices - matches device names against usernames only
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
      
      // Get device name which should match username
      const deviceName = device.name || device.localName || '';
      
      // Skip devices without a name - we need it for username matching
      if (!deviceName) {
        console.log('Skipping device without name:', device.id);
        return;
      }
      
      // Log processing with distance info
      console.log(`Processing device: ${device.id}, Name: ${deviceName}, RSSI: ${device.rssi}, ~${distance}m`);
      
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
        console.log('Fetched users for matching:', usersList.map(u => ({ id: u.id, username: u.username })));
      }
      
      // Match by device name directly against username
      console.log(`Attempting to match device name "${deviceName}" against usernames in database`);
      try {
        // Find a user with username matching the device name
        const matchedUserByName = usersList.find(
          user => {
            const match = (user.username || '').toLowerCase() === deviceName.toLowerCase();
            console.log(`Checking user ${user.username} against device name ${deviceName}: ${match ? 'MATCH' : 'NO MATCH'}`);
            return match;
          }
        );
        
        if (matchedUserByName) {
          console.log(`Found user with matching device name: ${matchedUserByName.username}`);
          
          // Check if we already have this user in our list
          if (users.some(user => user.id === matchedUserByName.id)) {
            console.log('User already in nearby list:', matchedUserByName.username);
            return;
          }
          
          // Store the device ID for this user to verify them
          console.log(`Attempting to store device ID for user ${matchedUserByName.id}: ${device.id}`);
          
          try {
            // Check if the user is already verified
            const alreadyVerified = await isUserVerified(matchedUserByName.id);
            console.log(`User ${matchedUserByName.username} verification status: ${alreadyVerified ? 'Verified' : 'Not Verified'}`);
            
            if (!alreadyVerified) {
              // Store the discovered device ID for this user
              const storeResult = await storeDiscoveredDeviceId(matchedUserByName.id, device.id);
              
              if (storeResult.success) {
                console.log(`Successfully stored device ID for user ${matchedUserByName.username}: ${device.id}`);
                
                // Update the local user data to include verification status
                matchedUserByName.is_verified = true; 
                matchedUserByName.mac_address = device.id;
              } else {
                console.warn(`Failed to store device ID for user ${matchedUserByName.username}:`, storeResult.error);
              }
            } else {
              console.log(`User ${matchedUserByName.username} is already verified`);
            }
          } catch (verificationError) {
            console.error('Error during device ID storage process:', verificationError);
          }
          
          // Add the user to our list with device info
          setUsers(prevUsers => [...prevUsers, {
            ...matchedUserByName,
            deviceId: device.id,
            rssi: device.rssi,
            distance: distance,
            lastActive: new Date().toISOString()
          }]);
          return;
        } else {
          console.log(`No username match found for device name: ${deviceName}`);
        }
      } catch (err) {
        console.error('Error matching user by device name:', err);
      }
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
        
        // Check authorization status
        const authorized = bleService.isBluetoothAuthorized();
        setIsAuthorized(authorized);
        console.log('BLE authorization status:', authorized);
        
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

  // Add a periodic authorization check
  useEffect(() => {
    // Set up periodic authorization check (every 2 seconds)
    const authCheckInterval = setInterval(() => {
      try {
        const bleService = BleService.getInstance();
        const isAuthorized = bleService.isBluetoothAuthorized();
        setIsAuthorized(prev => {
          if (prev !== isAuthorized) {
            console.log(`Authorization status changed: ${prev} -> ${isAuthorized}`);
            return isAuthorized;
          }
          return prev;
        });
      } catch (error) {
        console.error('Error checking BLE authorization:', error);
      }
    }, 2000);
    
    return () => {
      clearInterval(authCheckInterval);
    };
  }, []);

  // Function to start scanning for devices
  const startScanningForDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsScanning(true);
      
      const bleService = BleService.getInstance();
      console.log('Starting BLE scanning from hook...');
      
      // Check authorization before starting scan
      const authorized = bleService.isBluetoothAuthorized();
      if (isAuthorized !== authorized) {
        console.log(`Updating authorization state before scan: ${isAuthorized} -> ${authorized}`);
        setIsAuthorized(authorized);
      }
      
      const success = await bleService.startScanning((device) => {
        // Check for authorization changes on every device event
        const currentAuthorized = bleService.isBluetoothAuthorized();
        if (isAuthorized !== currentAuthorized) {
          console.log(`Authorization changed during scan: ${isAuthorized} -> ${currentAuthorized}`);
          setIsAuthorized(currentAuthorized);
        }
        
        // Continue with normal device handling
        handleDeviceFound(device);
      });
      
      if (success) {
        console.log('BLE scanning started successfully');
        // Also start advertising our presence (Android only)
        if (Platform.OS === 'android') {
          const advResult = await bleService.startAdvertising();
          console.log('Advertising result:', advResult);
        }
      } else {
        // Double-check authorization after failed scan attempt
        const postCheckAuth = bleService.isBluetoothAuthorized();
        if (isAuthorized !== postCheckAuth) {
          console.log(`Authorization changed after failed scan: ${isAuthorized} -> ${postCheckAuth}`);
          setIsAuthorized(postCheckAuth);
        }
        
        setError('Could not start scanning. Please ensure Bluetooth is enabled.');
        setIsScanning(false);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error in startScanningForDevices:', err);
      
      // Check authorization status after error
      try {
        const bleService = BleService.getInstance();
        const authorized = bleService.isBluetoothAuthorized();
        if (isAuthorized !== authorized) {
          console.log(`Authorization changed after scan error: ${isAuthorized} -> ${authorized}`);
          setIsAuthorized(authorized);
        }
      } catch (authError) {
        console.error('Error checking authorization after scan error:', authError);
      }
      
      setError('Failed to start scanning. Please try again.');
      setLoading(false);
      setIsScanning(false);
    }
  }, [handleDeviceFound, isAuthorized]);

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
    isAuthorized,
    deviceInfo,
    allUsers,
    refreshUsers,
    startScanning: startScanningForDevices,
    stopScanning: stopScanningAndAdvertising,
    setUsers  // Expose setUsers for direct manipulation in force refresh
  };
}