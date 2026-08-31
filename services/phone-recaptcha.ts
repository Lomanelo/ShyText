import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { ApplicationVerifier } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

const RECAPTCHA_URL =
  process.env.EXPO_PUBLIC_PHONE_RECAPTCHA_URL ||
  'https://myshytext.firebaseapp.com/phone-recaptcha.html';

type Verifier = ApplicationVerifier & { _reset: () => void };

function tokenFromUrl(url: string): string | null {
  const normalized = url
    .replace(/^com\.rahimrady\.myshytext:\/\//, 'https://shytext.local/')
    .replace(/^exp\+[^:]+:\/\//, 'https://shytext.local/')
    .replace(/^exp:\/\//, 'https://shytext.local/');
  try {
    const parsed = new URL(normalized);
    const token = parsed.searchParams.get('token') || parsed.hash.replace(/^#token=/, '');
    return token || null;
  } catch {
    const match = url.match(/[?&#]token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export function createBrowserRecaptchaVerifier(): Verifier {
  return {
    type: 'recaptcha',
    async verify() {
      const redirectUrl = Linking.createURL('phone-auth');
      const url = `${RECAPTCHA_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('cancelled');
      }
      if (result.type !== 'success') {
        throw new Error('Could not verify this device.');
      }
      const token = tokenFromUrl(result.url);
      if (!token) throw new Error('Could not verify this device.');
      return token;
    },
    _reset() {},
  };
}
