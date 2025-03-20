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
  private scanTimeout: NodeJS.Timeout | null = null;
  private advertiserInitialized: boolean = false;
  private supportsAdvertising: boolean = false;
  private isInitialized: boolean = false;
  private stateSubscription: Subscription | null = null;
  private isInitializing: boolean = false;
  private onDeviceFoundCallback: ((device: Device) => void) | null = null;
  private foundDevices: Set<string> = new Set();

  private constructor() {
    this.supportsAdvertising = Platform.OS === 'android';
    
    // We no longer initialize BleManager here - we'll do it lazily
    console.log('BLE Service created, will initialize on demand');
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
      console.log('Lazily initializing BleManager');
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
          console.log('Location permission granted');
          return true;
        } else {
          console.log('Location permission denied');
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
    console.log('BLE state changed to:', state);
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
      console.log('BLE initialization already in progress');
      return false;
    }
    
    this.isInitializing = true;
    
    try {
      // Print BLE availability information
      console.log('Platform:', Platform.OS, Platform.Version);
      
      // Get the BleManager instance
      const bleManager = this.getBleManager();
      
      // Set up the state subscription directly using onStateChange
      this.stateSubscription = bleManager.onStateChange(this.handleStateChange, true);
      
      // Force BLE to be enabled on iOS since state detection can be unreliable
      if (Platform.OS === 'ios') {
        // On iOS, we'll assume BLE is available and proceed
        console.log('Running on iOS - bypassing state check and assuming Bluetooth is enabled');
        
        // Request permissions through Info.plist (handled by the system)
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          console.error('Location permission not granted');
          this.isInitializing = false;
          return false;
        }
        
        console.log('Permissions granted, setting BLE as initialized');
        this.isInitialized = true;
        this.printDeviceInfo();
        this.isInitializing = false;
        return true;
      }
      
      // Regular initialization flow for Android
      
      // Get current state
      const state = await bleManager.state();
      console.log('Current BLE state:', state);
      
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
        console.log('BLE not powered on, current state:', state);
        // State subscription already set up earlier
        this.isInitializing = false;
        return false;
      }
      
      // State is PoweredOn, proceed with initialization
      
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.error('Location permission not granted');
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
            console.log('BLE Advertiser initialized successfully');
          } else {
            console.warn('BLE Advertiser module not properly initialized');
          }
        } catch (error) {
          console.error('Failed to initialize BLE Advertiser:', error);
          // Non-fatal, continue
        }
      } else {
        console.log('Running on iOS: BLE Advertising is not supported, scanning only mode enabled');
      }
      
      this.isInitialized = true;
      console.log('BLE initialized successfully, ready for scanning/advertising');
      
      // Print device info to help debug
      this.printDeviceInfo();
      
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error('Failed to initialize BLE service:', error);
      this.isInitializing = false;
      return false;
    }
  }

  // Helper method to print device info for debugging
  private printDeviceInfo = async (): Promise<void> => {
    try {
      console.log('----------- DEVICE INFO -----------');
      console.log('Platform:', Platform.OS);
      console.log('Version:', Platform.Version);
      console.log('BT State:', await this.getBleManager().state());
      console.log('Advertising Supported:', this.supportsAdvertising);
      console.log('Advertising Initialized:', this.advertiserInitialized);
      console.log('BLE Initialized:', this.isInitialized);
      console.log('---------------------------------');
    } catch (error) {
      console.error('Error printing device info:', error);
    }
  }

  public async startAdvertising(): Promise<boolean> {
    try {
      if (!await this.initialize()) {
        console.log('Cannot start advertising - BLE not initialized');
        return false;
      }
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        console.error('No user logged in');
        return false;
      }

      if (!this.supportsAdvertising) {
        // iOS doesn't support advertising but we'll return true
        console.log('Advertising not supported on iOS, skipping advertising');
        return true;
      }

      if (!this.advertiserInitialized) {
        console.warn('Cannot start advertising: BLE Advertiser not initialized');
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
      console.log('Started BLE advertising with aggressive mode as:', userIdentifier);
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
      console.log('Stopped BLE advertising');
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
      
      // More aggressive logging to debug discovery issues
      const deviceInfo = {
        id: enhancedDevice.id,
        name: enhancedDevice.name || 'unnamed',
        localName: enhancedDevice.localName || 'no-local-name',
        rssi: enhancedDevice.rssi,
        manufactureData: enhancedDevice.manufacturerData ? 'present' : 'none',
        serviceUUIDs: enhancedDevice.serviceUUIDs ? enhancedDevice.serviceUUIDs.join(',') : 'none',
        isConnectable: enhancedDevice.isConnectable,
        lastSeen: enhancedDevice.lastSeen
      };
      
      // Log all discovered devices
      console.log(`[${Platform.OS}] Device details:`, JSON.stringify(deviceInfo));
      
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
      
      // Log found device with name for username matching
      console.log(`[${Platform.OS}] Found device that might be a user:`, deviceName || localName, 'with ID:', enhancedDevice.id, 'RSSI:', enhancedDevice.rssi);
      
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
    scanDuration: number = 30000 // Reduced from 60s to 30s for more frequent restarts
  ): Promise<boolean> {
    try {
      if (!await this.initialize()) {
        console.log('Cannot start scanning - BLE not initialized');
        return false;
      }

      if (this.isScanning) {
        console.log('Already scanning');
        return true;
      }

      this.isScanning = true;
      this.onDeviceFoundCallback = onDeviceFound;
      this.foundDevices.clear(); // Reset found devices for this session
      
      // Get current user ID to filter out self-detection
      const currentUser = getCurrentUser();
      const currentUserId = currentUser?.uid || '';
      console.log(`Current user ID for filtering: ${currentUserId}`);
      
      // Platform-specific optimized scan options - disable duplicates
      const scanOptions = Platform.OS === 'ios' 
        ? { 
            allowDuplicates: false, // Changed to false to prevent duplicate detections
          } 
        : { 
            allowDuplicates: false, // Changed to false to prevent duplicate detections
            scanMode: 2 // SCAN_MODE_LOW_LATENCY on Android
          };
          
      console.log(`Started ${Platform.OS} scanning with options:`, JSON.stringify(scanOptions));

      // Start device scan with platform-specific configuration
      this.getBleManager().startDeviceScan(
        null, // no service filter
        scanOptions,
        (error, device) => {
          if (error) {
            console.error(`Scan error on ${Platform.OS}:`, error);
            
            // On iOS, just log the error but continue scanning
            if (Platform.OS === 'ios') {
              return;
            }
            
            // On Android, we can try to recover from some errors
            if (Platform.OS === 'android') {
              // Try restarting scan after a short delay
              setTimeout(() => {
                if (this.isInitialized && this.isScanning) {
                  this.stopScanning();
                  this.startScanning(onDeviceFound, scanDuration);
                }
              }, 2000);
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
              console.log(`[${Platform.OS}] Skipping own device: ${deviceName} (${device.id})`);
              return;
            }
            
            // Create a timestamp but don't modify the device directly
            const timestamp = Date.now();
            
            // Log found devices
            if (device.name || device.localName) {
              console.log(`[${Platform.OS}] Found device: ${device.id}, Name: ${device.name || device.localName || 'unnamed'}, RSSI: ${device.rssi}, Time: ${new Date(timestamp).toLocaleTimeString()}`);
            }
            
            // Pass the original device - our handler will add the timestamp
            this.handleDeviceFound(device);
          }
        }
      );

      // Set timeout to stop and restart scanning periodically to refresh the device list
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }
      
      this.scanTimeout = setTimeout(() => {
        console.log(`[${Platform.OS}] Scan cycle complete, restarting scan...`);
        this.stopScanning();
        
        // Automatically restart scanning after a short break
        setTimeout(() => {
          if (this.isInitialized) {
            console.log(`[${Platform.OS}] Starting new scan cycle...`);
            this.startScanning(onDeviceFound, scanDuration);
          }
        }, 1000); // Reduced from 2000ms to 1000ms for faster restarts
      }, scanDuration);
      
      return true;
    } catch (error) {
      console.error(`[${Platform.OS}] Failed to start scanning:`, error);
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

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    console.log('Stopped scanning for devices');
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
    console.log('Cleaning up BLE service...');
    
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
      
      // Clear timeouts
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
        this.scanTimeout = null;
      }
      
      // Reset flags
      this.isInitialized = false;
      this.isInitializing = false;
      
      console.log('BLE service cleaned up successfully');
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
}

export default BleService; 