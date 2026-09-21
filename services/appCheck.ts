import { Platform } from 'react-native';
import { initializeAppCheck as initializeJsAppCheck, CustomProvider } from 'firebase/app-check';
import app from './firebase';

let started = false;

/**
 * Device attestation for Firestore / Auth abuse resistance.
 * Requires a production/dev-client rebuild after adding the native module.
 * Enable App Check in Firebase Console (DeviceCheck / App Attest + Play Integrity).
 */
export async function startAppCheck() {
  if (started || Platform.OS === 'web') return;
  started = true;
  try {
    const {
      initializeAppCheck,
      ReactNativeFirebaseAppCheckProvider,
      getToken,
    } = require('@react-native-firebase/app-check') as typeof import('@react-native-firebase/app-check');
    const { getApp } = require('@react-native-firebase/app') as typeof import('@react-native-firebase/app');

    const rnProvider = new ReactNativeFirebaseAppCheckProvider();
    rnProvider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
      },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      },
    });

    const rnAppCheck = initializeAppCheck(getApp(), {
      provider: rnProvider,
      isTokenAutoRefreshEnabled: true,
    });

    const jsProvider = new CustomProvider({
      getToken: async () => {
        const result = await getToken(rnAppCheck, true);
        return {
          token: result.token,
          expireTimeMillis: Date.now() + 55 * 60 * 1000,
        };
      },
    });

    initializeJsAppCheck(app, {
      provider: jsProvider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Missing native module / console not configured yet — do not block launch.
    started = false;
  }
}
