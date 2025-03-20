declare module 'react-native-ble-advertiser' {
  interface BLEAdvertiser {
    setCompanyId(companyId: number): void;
    broadcast(name: string, companyIds: number[], options?: any): Promise<void>;
    stop(): Promise<void>;
  }

  const advertiser: BLEAdvertiser;
  export default advertiser;
} 