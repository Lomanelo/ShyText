import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { getUserProfile, signInWithAppleToken, signInWithGoogleIdToken } from '../services/auth';

WebBrowser.maybeCompleteAuthSession();

const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';
const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '680911194317-g3amhmkgvie7gdmdcalkn14p46ralg1h.apps.googleusercontent.com';
const androidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  if (message.includes('email-already-in-use')) return 'This account already exists. Try signing in.';
  if (message.includes('invalid-email')) return 'Enter a valid email.';
  if (message.includes('wrong-password') || message.includes('invalid-credential')) {
    return 'Those details do not match.';
  }
  if (message.includes('too-many-requests')) return 'Too many attempts. Try again later.';
  if (message.includes('weak-password')) return 'Use at least 6 characters.';
  if (message.includes('network-request-failed')) return 'Check your connection and try again.';
  return 'Unable to continue. Please try again.';
}

async function afterSignIn() {
  const { auth } = await import('../services/firebase');
  const user = auth.currentUser;
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  if (profile?.displayName) {
    router.replace('/(tabs)/nearby');
  } else {
    router.replace('/(auth)/profile-setup');
  }
}

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri =
    Platform.OS === 'ios'
      ? 'com.rahimrady.myshytext://'
      : Platform.OS === 'android'
        ? 'com.rahimrady.myshytext:/oauth2redirect'
        : 'https://auth.expo.io/@rahimrady/myshytext';

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) {
      setError('Sign-in failed. Please try again.');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await signInWithGoogleIdToken(idToken);
        await afterSignIn();
      } catch (err) {
        setError(authErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [response]);

  return {
    loading,
    error,
    ready: !!request,
    signIn: async () => {
      setError(null);
      if (!request) {
        setError('Google sign-in is not ready yet.');
        return;
      }
      await promptAsync();
    },
  };
}

export function useAppleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    available: Platform.OS === 'ios',
    loading,
    error,
    signIn: async () => {
      setLoading(true);
      setError(null);
      try {
        const nonce = Array.from(Crypto.getRandomBytes(16))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashed,
        });
        if (!credential.identityToken) throw new Error('No Apple token.');
        await signInWithAppleToken(credential.identityToken, nonce);
        await afterSignIn();
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== 'ERR_REQUEST_CANCELED') {
          setError(authErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    },
  };
}

export { authErrorMessage };
