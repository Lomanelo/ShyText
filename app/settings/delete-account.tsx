import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { OtpSlots } from '../../components/OtpSlots';
import { type, useTheme } from '../../theme';
import {
  currentUserPhoneNumber,
  deleteOwnAccount,
  reauthenticateWithPhoneCode,
  sendAccountPhoneVerification,
} from '../../services/auth';
import { createBrowserRecaptchaVerifier } from '../../services/phone-recaptcha';
import { authErrorMessage } from '../../hooks/usePhoneAuth';
import { useTranslation } from 'react-i18next';

const RESEND_MS = 45_000;

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const phone = currentUserPhoneNumber();
  const [step, setStep] = useState<'info' | 'code'>('info');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const submittedCode = useRef('');

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const codeReady = /^\d{6}$/.test(code);

  const sendOtp = async () => {
    if (!phone) {
      Alert.alert(t('settings.deleteFailed'), t('errors.noPhoneOnAccount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await sendAccountPhoneVerification(createBrowserRecaptchaVerifier());
      setVerificationId(id);
      setStep('code');
      setCode('');
      submittedCode.current = '';
      setResendAt(Date.now() + RESEND_MS);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmStart = () => {
    Alert.alert(t('settings.deleteConfirmTitle'), t('settings.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteSendCode'),
        style: 'destructive',
        onPress: () => void sendOtp(),
      },
    ]);
  };

  const finishDelete = async (otp: string) => {
    if (!verificationId) {
      setError(t('authErrors.sendCodeFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithPhoneCode(verificationId, otp);
      await deleteOwnAccount();
      router.replace('/(auth)/welcome');
    } catch (err) {
      Alert.alert(t('settings.deleteFailed'), authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {step === 'info' ? (
            <>
              <Text style={[type.title, { color: theme.text }]}>{t('settings.deleteTitle')}</Text>
              <Text style={[type.body, { color: theme.muted }]}>{t('settings.deleteBody')}</Text>
              <Text style={[type.body, { color: theme.muted }]}>{t('settings.deleteBody2')}</Text>
              <Text style={[type.body, { color: theme.muted }]}>{t('settings.deleteOtpHint')}</Text>
              {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
              <PrimaryButton
                title={t('settings.deleteAccount')}
                theme={theme}
                variant="danger"
                loading={busy}
                onPress={confirmStart}
              />
            </>
          ) : (
            <>
              <Text style={[type.title, { color: theme.text }]}>{t('settings.deleteEnterCode')}</Text>
              <Text style={[type.body, { color: theme.muted }]}>
                {t('auth.sentTo', { phone: phone ?? '' })}
              </Text>
              {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
              <OtpSlots
                value={code}
                theme={theme}
                onChange={(next) => {
                  setCode(next);
                  if (next.length === 6 && !busy && submittedCode.current !== next) {
                    submittedCode.current = next;
                    Haptics.selectionAsync();
                    void finishDelete(next);
                  }
                }}
              />
              <View style={styles.dock}>
                <PrimaryButton
                  title={t('settings.deleteConfirmWithCode')}
                  theme={theme}
                  variant="danger"
                  disabled={!codeReady}
                  loading={busy}
                  onPress={() => void finishDelete(code)}
                />
                <PrimaryButton
                  title={resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resendCode')}
                  theme={theme}
                  variant="secondary"
                  disabled={resendIn > 0 || busy}
                  onPress={() => void sendOtp()}
                />
                <Pressable
                  onPress={() => {
                    setStep('info');
                    setVerificationId(null);
                    setCode('');
                    submittedCode.current = '';
                    setError(null);
                  }}
                  style={styles.footer}
                >
                  <Text style={{ color: theme.accent, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 40 },
  dock: { gap: 8, marginTop: 8 },
  footer: { alignItems: 'center', paddingTop: 4, minHeight: 44, justifyContent: 'center' },
});
