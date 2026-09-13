import { Platform } from 'react-native';
import type { ApplicationVerifier } from 'firebase/auth';
import { createBrowserRecaptchaVerifier } from './phone-recaptcha';
import { sendPhoneVerification as sendJsPhoneVerification } from './auth';

function isNativeModuleMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Native module') ||
    msg.includes('not installed') ||
    msg.includes('Cannot find module') ||
    msg.includes('RNFirebase') ||
    /TurboModuleRegistry|Invariant Violation/i.test(msg)
  );
}

/**
 * Ask iOS for an APNs device token before phone verify.
 * Firebase Auth uses silent push for app verification; without a token it falls back to reCAPTCHA
 * and SMS shows myshytext.firebaseapp.com instead of "ShyText".
 */
async function ensureRemoteNotificationsReady(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.getPermissionsAsync().then(async (current) => {
      if (current.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    });
    // Device token registration (not Expo push token) — Auth needs APNs.
    await Notifications.getDevicePushTokenAsync();
  } catch (err) {
    if (__DEV__) {
      console.warn('[phone] Could not register for remote notifications', err);
    }
  }
}

/**
 * Native Firebase Auth phone verification (APNs on iOS / Play Integrity on Android).
 * Returns a verificationId that the JS SDK can confirm with PhoneAuthProvider.credential.
 *
 * Browser reCAPTCHA is only used when the native module is missing (old binary / web).
 * If native verify runs but APNs is misconfigured, Firebase itself falls back to reCAPTCHA
 * and SMS will still say myshytext.firebaseapp.com — fix by uploading an APNs key in Firebase
 * Console → Project settings → Cloud Messaging.
 */
export async function sendPhoneCodeNativeFirst(
  phoneNumber: string,
  browserVerifier: ApplicationVerifier = createBrowserRecaptchaVerifier()
): Promise<string> {
  if (Platform.OS === 'web') {
    return sendJsPhoneVerification(phoneNumber, browserVerifier);
  }

  try {
    await ensureRemoteNotificationsReady();
    const { getAuth, verifyPhoneNumber } = await import('@react-native-firebase/auth');
    const listener = verifyPhoneNumber(getAuth(), phoneNumber);
    const verificationId = await new Promise<string>((resolve, reject) => {
      listener.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.error) {
            reject(snapshot.error);
            return;
          }
          if (snapshot.verificationId) {
            resolve(snapshot.verificationId);
          }
        },
        (error) => reject(error)
      );
    });
    if (!verificationId) {
      throw new Error('native-phone-no-verification-id');
    }
    return verificationId;
  } catch (err) {
    if (isNativeModuleMissing(err)) {
      if (__DEV__) {
        console.warn('[phone] Native module missing, falling back to reCAPTCHA', err);
      }
      return sendJsPhoneVerification(phoneNumber, browserVerifier);
    }
    // Do not open the browser verifier here — that always brands SMS as firebaseapp.com.
    // Surface the native failure so APNs / console misconfig is obvious.
    throw err;
  }
}
