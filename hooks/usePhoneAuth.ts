import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getUserProfile, confirmPhoneVerification } from '../services/auth';
import { createBrowserRecaptchaVerifier } from '../services/phone-recaptcha';
import { sendPhoneCodeNativeFirst } from '../services/phone-native';
import { userFacingError } from '../utils/userError';
import i18n from '../i18n';

const RESEND_MS = 45_000;

/** @deprecated Prefer userFacingError — kept for existing imports. */
export function authErrorMessage(error: unknown) {
  return userFacingError(error, i18n.t('authErrors.generic'));
}

async function afterSignIn() {
  const { auth } = await import('../services/firebase');
  const user = auth.currentUser;
  if (!user) return;
  await user.getIdToken(true);
  const profile = await getUserProfile(user.uid).catch(() => null);
  if (profile?.displayName || user.displayName) {
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
      const id = await sendPhoneCodeNativeFirst(phone, createBrowserRecaptchaVerifier());
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
        setError(i18n.t('authErrors.sendCodeFirst'));
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
