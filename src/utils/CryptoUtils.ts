import * as Crypto from 'expo-crypto';

export class CryptoUtils {
  // Generate a random string of specified length
  static randomNonceString(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = Crypto.getRandomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(bytes[i] % charset.length);
    }
    return result;
  }

  // Hash a string using SHA256
  static async sha256(input: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input
    );
    return digest;
  }
} 