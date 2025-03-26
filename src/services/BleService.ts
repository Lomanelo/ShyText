import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import BleAdvertiser from 'react-native-ble-advertiser';
import { getCurrentUser } from '../lib/firebase';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

// Add a type extension for device with lastSeen property
interface EnhancedDevice extends Device {
  lastSeen?: number;
}

class BleService {
  private static instance: BleService;
  private bleManager: BleManager | null = null; // Change to null initially
  private isAdvertising: boolean = false;
  private isScanning: boolean = false;
  private companyId: number = 0x1234; // Unique company ID for ShyText
  private advertiserInitialized: boolean = false;
  private supportsAdvertising: boolean = false;
  private isInitialized: boolean = false;
  private stateSubscription: Subscription | null = null;
  private isInitializing: boolean = false;
  private onDeviceFoundCallback: ((device: Device) => void) | null = null;
  private foundDevices: Set<string> = new Set();
  private lastAuthorizationError: string | null = null;
  private authorizationErrorDetected: boolean = false;

  private constructor() {
    this.supportsAdvertising = Platform.OS === 'android';
    
    // We no longer initialize BleManager here - we'll do it lazily
  }

  public static getInstance(): BleService {
    if (!BleService.instance) {
      BleService.instance = new BleService();
    }
    return BleService.instance;
  }
  
  // Add this method to lazily initialize and return the BleManager
  private getBleManager(): BleManager {
    if (!this.bleManager) {
      this.bleManager = new BleManager();
    }
    return this.bleManager;
  }

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'ShyText needs access to your location to find nearby users.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          return false;
        }
      } catch (err) {
        console.error('Failed to request location permission:', err);
        return false;
      }
    }
    return true; // iOS handles permissions through Info.plist
  }

  // Handler for BLE state changes
  private handleStateChange = (state: State): void => {
    if (state === State.PoweredOn && !this.isInitialized) {
      // Now that BT is on, try initializing again
      this.isInitializing = false;
      this.initialize();
    }
  };

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    
    if (this.isInitializing) {
      return false;
    }
    
    this.isInitializing = true;
    
    try {
      // Get the BleManager instance
      const bleManager = this.getBleManager();
      
      // When reinitializing, we'll try to clear any authorization errors if the system's Bluetooth is actually on
      if (this.authorizationErrorDetected) {
        const state = await bleManager.state();
        
        // If the system shows Bluetooth is on but we've detected authorization errors previously,
        // we should re-test to see if permissions have been granted
        if (state === State.PoweredOn) {
          this.resetAuthorizationError();
        }
      }
      
      // Set up the state subscription directly using onStateChange
      this.stateSubscription = bleManager.onStateChange(this.handleStateChange, true);
      
      // Force BLE to be enabled on iOS since state detection can be unreliable
      if (Platform.OS === 'ios') {
        // On iOS, we'll assume BLE is available and proceed
        
        // Request permissions through Info.plist (handled by the system)
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          this.isInitializing = false;
          return false;
        }
        
        this.isInitialized = true;
        this.isInitializing = false;
        return true;
      }
      
      // Regular initialization flow for Android
      
      // Get current state
      const state = await bleManager.state();
      
      if (state === State.PoweredOff) {
        // Bluetooth is off, alert user
        Alert.alert(
          'Bluetooth is Off',
          'Please turn on Bluetooth to discover nearby users.',
          [{ text: 'OK' }]
        );
        
        // State subscription already set up earlier
        this.isInitializing = false;
        return false;
      }
      
      if (state !== State.PoweredOn) {
        // State subscription already set up earlier
        this.isInitializing = false;
        return false;
      }
      
      // State is PoweredOn, proceed with initialization
      
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        this.isInitializing = false;
        return false;
      }
      
      // Only initialize advertiser on Android
      if (this.supportsAdvertising) {
        try {
          if (typeof BleAdvertiser !== 'undefined' && 
              typeof BleAdvertiser.setCompanyId === 'function') {
            BleAdvertiser.setCompanyId(this.companyId);
            this.advertiserInitialized = true;
          } else {
            console.warn('BLE Advertiser module not properly initialized');
          }
        } catch (error) {
          console.error('Failed to initialize BLE Advertiser:', error);
          // Non-fatal, continue
        }
      }
      
      this.isInitialized = true;
      
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error('Failed to initialize BLE service:', error);
      this.isInitializing = false;
      return false;
    }
  }

  // Add method to check if BLE is authorized based on errors
  public isBluetoothAuthorized(): boolean {
    // If authorization error was previously detected, return false
    if (this.authorizationErrorDetected) {
      return false;
    }
    
    // For iOS: check for all known authorization error message variations
    if (Platform.OS === 'ios' && this.lastAuthorizationError) {
      const errorMessages = [
        'Device is not authorized to use BluetoothLE',
        'Bluetooth LE is powered off',
        'Bluetooth is not authorized for this application',
        'The user denied access to Bluetooth'
      ];
      
      for (const message of errorMessages) {
        if (this.lastAuthorizationError.includes(message)) {
          this.authorizationErrorDetected = true;
          console.log(`Bluetooth not authorized: ${message}`);
          return false;
        }
      }
    }
    
    // For Android, we rely on BT status and permissions which are handled in initialize()
    return this.isInitialized;
  }

  // Helper method to print device info for debugging
  private printDeviceInfo = async (): Promise<void> => {
    // We're simplifying logging, so this method is left empty
  }

  public async startAdvertising(): Promise<boolean> {
    try {
      if (!await this.initialize()) {
        return false;
      }
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        console.error('No user logged in');
        return false;
      }

      if (!this.supportsAdvertising) {
        // iOS doesn't support advertising but we'll return true
        return true;
      }

      if (!this.advertiserInitialized) {
        return false;
      }
      
      // Get username from auth user if available
      const username = currentUser.displayName || currentUser.uid;
      
      // Simple identifier for advertising that contains only the username
      const userIdentifier = `ShyText_${username}`;
      
      // Use more aggressive advertising settings 
      await BleAdvertiser.broadcast(userIdentifier, [this.companyId], {
        advertiseMode: 0, // ADVERTISE_MODE_LOW_LATENCY
        txPowerLevel: 3, // ADVERTISE_TX_POWER_HIGH
        connectable: true,
        includeDeviceName: true,
        manufacturerId: this.companyId,
      });
      
      this.isAdvertising = true;
      return true;
    } catch (error) {
      console.error('Failed to start advertising:', error);
      this.isAdvertising = false;
      return false;
    }
  }

  public async stopAdvertising(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return true; // Nothing to stop
      }
      
      if (!this.supportsAdvertising || !this.isAdvertising) {
        return true;
      }

      await BleAdvertiser.stop();
      this.isAdvertising = false;
      return true;
    } catch (error) {
      console.error('Failed to stop advertising:', error);
      return false;
    }
  }

  private handleDeviceFound = (device: Device): void => {
    try {
      // Get the current time if not provided
      const enhancedDevice = device as EnhancedDevice;
      if (!enhancedDevice.lastSeen) {
        enhancedDevice.lastSeen = Date.now();
      }
  
      // Skip devices with no identifiers
      if (!enhancedDevice) {
        return;
      }
      
      // Get device name - this is the primary identifier now
      const deviceName = enhancedDevice.name || '';
      const localName = enhancedDevice.localName || '';
      
      // Skip devices without a name since we need it for username matching
      if (!deviceName && !localName) {
        return;
      }
      
      // Skip if we've already seen this device in this scan session
      if (this.foundDevices.has(enhancedDevice.id)) {
        return;
      }
      
      // Mark device as found
      this.foundDevices.add(enhancedDevice.id);
      
      // Log only found devices with names
      console.log(`FOUND_DEVICE: ${deviceName || localName} (ID: ${enhancedDevice.id}, RSSI: ${enhancedDevice.rssi})`);
      
      // Pass device to callback for user association
      if (this.onDeviceFoundCallback) {
        this.onDeviceFoundCallback(enhancedDevice);
      }
    } catch (error) {
      console.error('Error handling found device:', error);
    }
  }

  public async startScanning(
    onDeviceFound: (device: Device) => void,
    scanDuration: number = 10000 // Parameter kept for API compatibility
  ): Promise<boolean> {
    try {
      if (!await this.initialize()) {
        console.log('Cannot start scanning - BLE not initialized');
        return false;
      }

      if (this.isScanning) {
        return true;
      }

      this.isScanning = true;
      this.onDeviceFoundCallback = onDeviceFound;
      this.foundDevices.clear(); // Reset found devices for this session
      
      // Get current user ID to filter out self-detection
      const currentUser = getCurrentUser();
      const currentUserId = currentUser?.uid || '';
      
      // Platform-specific optimized scan options - disable duplicates
      const scanOptions = Platform.OS === 'ios' 
        ? { 
            allowDuplicates: false, // Changed to false to prevent duplicate detections
          } 
        : { 
            allowDuplicates: false, // Changed to false to prevent duplicate detections
            scanMode: 2 // SCAN_MODE_LOW_LATENCY on Android
          };

      // Start device scan with platform-specific configuration
      this.getBleManager().startDeviceScan(
        null, // no service filter
        scanOptions,
        (error, device) => {
          if (error) {
            console.error(`Scan error on ${Platform.OS}:`, error);
            
            // Track authorization errors for visibility status
            if (error.message) {
              // Store the full error message
              this.lastAuthorizationError = error.message;
              
              // Check for any authorization-related error patterns
              const errorMessages = [
                'Device is not authorized to use BluetoothLE',
                'Bluetooth LE is powered off',
                'Bluetooth is not authorized for this application',
                'The user denied access to Bluetooth'
              ];
              
              for (const message of errorMessages) {
                if (error.message.includes(message)) {
                  this.authorizationErrorDetected = true;
                  break;
                }
              }
            }
            return;
          }

          if (device) {
            // Skip if the device has our own ID (prevent self-detection)
            const deviceName = device.name || device.localName || '';
            
            // Check if device ID or name contains our user ID - to avoid detecting self
            if (device.id.includes(currentUserId) || 
                deviceName.includes(currentUserId) ||
                (currentUser?.displayName && deviceName.includes(currentUser.displayName))) {
              return;
            }
            
            // Pass the original device - our handler will add the timestamp
            this.handleDeviceFound(device);
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to start scanning:`, error);
      this.isScanning = false;
      return false;
    }
  }

  public stopScanning(): void {
    if (!this.isScanning) {
      return;
    }

    this.getBleManager().stopDeviceScan();
    this.isScanning = false;
    this.onDeviceFoundCallback = null;
  }

  public isCurrentlyAdvertising(): boolean {
    return this.isInitialized && this.isAdvertising;
  }

  public isCurrentlyScanning(): boolean {
    return this.isInitialized && this.isScanning;
  }

  public isAdvertisingSupported(): boolean {
    return this.supportsAdvertising;
  }

  public cleanUp(): void {
    try {
      // Stop scanning
      if (this.isScanning) {
        this.stopScanning();
      }
      
      // Stop advertising
      if (this.isAdvertising) {
        this.stopAdvertising();
      }
      
      // Remove state subscription
      if (this.stateSubscription) {
        try {
          this.stateSubscription.remove();
        } catch (e) {
          console.warn('Error removing state subscription:', e);
        }
        this.stateSubscription = null;
      }
      
      // Clear callbacks
      this.onDeviceFoundCallback = null;
      
      // Reset flags
      this.isInitialized = false;
      this.isInitializing = false;
    } catch (error) {
      console.error('Error during BLE cleanup:', error);
    }
  }

  // Authentication based on username (previously device name)
  public async authenticateByUsername(username: string): Promise<{success: boolean, userId?: string, error?: string}> {
    try {
      console.log('Attempting authentication with username:', username);
      
      // Ensure username has @shytext suffix
      let normalizedUsername = username.trim();
      if (!normalizedUsername.includes('@shytext')) {
        normalizedUsername = `${normalizedUsername}@shytext`;
      }
      
      console.log('Normalized username for auth:', normalizedUsername);
      
      // Import Firebase modules
      const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
      
      // Query Firestore for a user with matching username
      const db = getFirestore();
      
      // First try exact match
      console.log('Trying exact match for username:', normalizedUsername);
      let q = query(collection(db, 'profiles'), where('username', '==', normalizedUsername));
      let querySnapshot = await getDocs(q);
      
      console.log(`Exact match query returned ${querySnapshot.docs.length} results`);
      
      // If exact match fails, try case-insensitive match
      if (querySnapshot.empty) {
        console.log('No exact match found, trying case-insensitive match');
        
        // Get all users and manually filter by case-insensitive match
        q = query(collection(db, 'profiles'));
        querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.docs.length} total user profiles to check`);
        
        const matchingDocs = querySnapshot.docs.filter((doc: any) => {
          const docUsername = doc.data().username;
          const match = docUsername && docUsername.toLowerCase() === normalizedUsername.toLowerCase();
          console.log(`Checking ${docUsername} against ${normalizedUsername}: ${match ? 'MATCH' : 'NO MATCH'}`);
          return match;
        });
        
        if (matchingDocs.length > 0) {
          // Found a case-insensitive match
          const userDoc = matchingDocs[0];
          const userId = userDoc.id;
          
          console.log('Found user via case-insensitive matching:', userId);
          return { success: true, userId };
        }
        
        console.log('No matching username found in database');
        return { success: false, error: 'No account found with this username' };
      }
      
      // Get the user ID from the exact match
      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      
      console.log('Found user via exact username match:', userId);
      return { success: true, userId };
    } catch (error) {
      console.error('Error in authenticateByUsername:', error);
      return { success: false, error: String(error) };
    }
  }
  
  // Updated method to use device name for authentication by matching against usernames
  public async authenticateByDeviceName(): Promise<{success: boolean, userId?: string, error?: string}> {
    try {
      // Get the device's name to match against usernames in the database
      let deviceName = '';
      
      // Try to get the device name using DeviceInfo
      try {
        const DeviceInfo = require('react-native-device-info');
        deviceName = await DeviceInfo.getDeviceName();
        console.log('Got device name for authentication:', deviceName);
      } catch (err) {
        console.error('Error getting device name:', err);
        return { success: false, error: 'Could not get device name for authentication' };
      }
      
      if (!deviceName) {
        console.error('No device name available for authentication');
        return { success: false, error: 'No device name available for authentication' };
      }
      
      // Now use the device name to authenticate by username
      // Device name should already include @shytext suffix if user set it correctly
      return await this.authenticateByUsername(deviceName);
    } catch (error) {
      console.error('Error in authenticateByDeviceName:', error);
      return { success: false, error: String(error) };
    }
  }

  // Reset authorization errors - use this when BT is re-enabled
  public resetAuthorizationError(): void {
    this.lastAuthorizationError = null;
    this.authorizationErrorDetected = false;
  }
}

export default BleService; 