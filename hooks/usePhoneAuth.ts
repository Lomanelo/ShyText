import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { getUserProfile, sendPhoneVerification, confirmPhoneVerification } from '../services/auth';
import { createBrowserRecaptchaVerifier } from '../services/phone-recaptcha';

import i18n from '../i18n';

const RESEND_MS = 45_000;

export function authErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.toLowerCase();
  if (raw === 'cancelled' || message.includes('cancelled')) return i18n.t('authErrors.cancelled');
  if (message.includes('invalid-phone-number') || message.includes('missing-phone-number')) {
    return i18n.t('authErrors.invalidPhone');
  }
  if (message.includes('invalid-verification-code')) return i18n.t('authErrors.invalidCode');
  if (message.includes('invalid-verification-id') || message.includes('session-expired')) {
    return i18n.t('authErrors.expiredCode');
  }
  if (message.includes('too-many-requests') || message.includes('quota-exceeded')) {
    return i18n.t('authErrors.tooMany');
  }
  if (message.includes('operation-not-allowed')) {
    return i18n.t('authErrors.notEnabled');
  }
  if (message.includes('captcha-check-failed')) return i18n.t('authErrors.captcha');
  if (message.includes('network-request-failed')) return i18n.t('authErrors.network');
  if (message.includes('user-disabled')) return i18n.t('authErrors.disabled');
  if (message.includes('permission') || message.includes('insufficient')) {
    return i18n.t('authErrors.permission');
  }
  return i18n.t('authErrors.generic');
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
