import { Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import DeviceInfo from 'react-native-device-info';

// Get the device's UUID based on platform-specific methods
export const getDeviceUUID = async (): Promise<string> => {
  try {
    // First try to get the device's Bluetooth MAC address (on Android)
    // or identifierForVendor (on iOS)
    if (Platform.OS === 'android') {
      try {
        // On Android, we can try to get the Bluetooth MAC address
        const macAddress = await DeviceInfo.getMacAddress();
        if (macAddress && macAddress !== '02:00:00:00:00:00') {
          // Clean up the MAC address to make it a valid UUID
          return `android-${macAddress.replace(/:/g, '')}`;
        }
      } catch (error) {
        console.warn('Could not get MAC address:', error);
      }
    }
    
    // On iOS, we can use the identifierForVendor which is unique per device
    try {
      const uniqueId = await DeviceInfo.getUniqueId();
      if (uniqueId) {
        return `${Platform.OS}-${uniqueId}`;
      }
    } catch (error) {
      console.warn('Could not get unique ID:', error);
    }
    
    // Fallback: Get the device name + device ID to create a unique identifier
    const deviceName = DeviceInfo.getDeviceNameSync();
    const deviceId = DeviceInfo.getDeviceId();
    
    // Combine them with platform info to make it more unique
    return `${Platform.OS}-${deviceName}-${deviceId}-${Date.now()}`;
  } catch (error) {
    console.error('Error getting device UUID:', error);
    // Final fallback: generate a random UUID
    return `fallback-${Platform.OS}-${Math.random().toString(36).substring(2, 15)}`;
  }
};

// Get the Bluetooth manager state and adapter info
export const getBleAdapterInfo = async (): Promise<any> => {
  try {
    const bleManager = new BleManager();
    const state = await bleManager.state();
    
    return {
      state,
      platform: Platform.OS,
      model: DeviceInfo.getModel(),
      systemVersion: Platform.Version,
      isEmulator: await DeviceInfo.isEmulator()
    };
  } catch (error) {
    console.error('Error getting BLE adapter info:', error);
    return {
      state: 'unknown',
      error: String(error)
    };
  }
}; 