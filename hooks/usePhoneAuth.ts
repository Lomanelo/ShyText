import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { getUserProfile, sendPhoneVerification, confirmPhoneVerification } from '../services/auth';
import { createBrowserRecaptchaVerifier } from '../services/phone-recaptcha';

const RESEND_MS = 45_000;

export function authErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.toLowerCase();
  if (raw === 'cancelled' || message.includes('cancelled')) return 'Verification cancelled.';
  if (message.includes('invalid-phone-number') || message.includes('missing-phone-number')) {
    return 'Enter a valid mobile number with country code.';
  }
  if (message.includes('invalid-verification-code')) return 'That code is not correct.';
  if (message.includes('invalid-verification-id') || message.includes('session-expired')) {
    return 'That code expired. Send a new one.';
  }
  if (message.includes('too-many-requests') || message.includes('quota-exceeded')) {
    return 'Too many attempts. Try again later.';
  }
  if (message.includes('operation-not-allowed')) {
    return 'Phone sign-in is not enabled yet. Turn on Phone in Firebase Authentication.';
  }
  if (message.includes('captcha-check-failed')) return 'Device check failed. Try again.';
  if (message.includes('network-request-failed')) return 'Check your connection and try again.';
  if (message.includes('user-disabled')) return 'This account is disabled.';
  if (message.includes('permission') || message.includes('insufficient')) {
    return 'Signed in, but the server is still blocking profile access. Try again in a moment.';
  }
  return 'Unable to continue. Please try again.';
}

async function afterSignIn() {
  const { auth } = await import('../services/firebase');
  const user = auth.currentUser;
  if (!user) return;
  await user.getIdToken(true);
  const profile = await getUserProfile(user.uid);
  if (profile?.displayName) {
    router.replace('/(tabs)/nearby');
  } else {
    router.replace('/(auth)/profile-setup');
  }
}

export function usePhoneAuth() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [e164, setE164] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);

  const sendCode = async (phone: string) => {
    setLoading(true);
    setError(null);
    try {
      const id = await sendPhoneVerification(phone, createBrowserRecaptchaVerifier());
      setVerificationId(id);
      setE164(phone);
      setStep('code');
      setResendAt(Date.now() + RESEND_MS);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    e164,
    loading,
    error,
    resendIn: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    sendCode,
    resend: () => (e164 ? sendCode(e164) : Promise.resolve()),
    changeNumber: () => {
      setStep('phone');
      setVerificationId(null);
      setError(null);
    },
    confirmCode: async (code: string) => {
      if (!verificationId) {
        setError('Send a code first.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await confirmPhoneVerification(verificationId, code);
        await afterSignIn();
      } catch (err) {
        setError(authErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
  };
}
