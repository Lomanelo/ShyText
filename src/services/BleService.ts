import { BleManager, Device } from 'react-native-ble-plx';
import BleAdvertiser from 'react-native-ble-advertiser';
import { getCurrentUser } from '../lib/firebase';

class BleService {
  private static instance: BleService;
  private bleManager: BleManager;
  private isAdvertising: boolean = false;
  private isScanning: boolean = false;
  private companyId: number = 0x1234; // Unique company ID for ShyText
  private scanTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.bleManager = new BleManager();
  }

  public static getInstance(): BleService {
    if (!BleService.instance) {
      BleService.instance = new BleService();
    }
    return BleService.instance;
  }

  public async startAdvertising(): Promise<boolean> {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        console.error('No user logged in');
        return false;
      }

      // Set company ID for advertising
      BleAdvertiser.setCompanyId(this.companyId);

      // Create a unique identifier for this user
      const userIdentifier = `ShyText_${currentUser.uid}`;

      // Start advertising
      await BleAdvertiser.broadcast(userIdentifier, [this.companyId], {});
      this.isAdvertising = true;
      console.log('Started BLE advertising');
      return true;
    } catch (error) {
      console.error('Failed to start advertising:', error);
      return false;
    }
  }

  public async stopAdvertising(): Promise<boolean> {
    try {
      await BleAdvertiser.stop();
      this.isAdvertising = false;
      console.log('Stopped BLE advertising');
      return true;
    } catch (error) {
      console.error('Failed to stop advertising:', error);
      return false;
    }
  }

  public startScanning(
    onDeviceFound: (device: Device) => void,
    scanDuration: number = 10000
  ): void {
    if (this.isScanning) {
      console.log('Already scanning');
      return;
    }

    this.isScanning = true;
    console.log('Started scanning for devices');

    // Start device scan
    this.bleManager.startDeviceScan(
      null, // null means scan for all services
      null, // null means scan for all characteristics
      (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (device && device.name?.startsWith('ShyText_')) {
          console.log('Found ShyText device:', device.name);
          onDeviceFound(device);
        }
      }
    );

    // Set timeout to stop scanning
    this.scanTimeout = setTimeout(() => {
      this.stopScanning();
    }, scanDuration);
  }

  public stopScanning(): void {
    if (!this.isScanning) {
      return;
    }

    this.bleManager.stopDeviceScan();
    this.isScanning = false;

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    console.log('Stopped scanning for devices');
  }

  public isCurrentlyAdvertising(): boolean {
    return this.isAdvertising;
  }

  public isCurrentlyScanning(): boolean {
    return this.isScanning;
  }
}

export default BleService; 