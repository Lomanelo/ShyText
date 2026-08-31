import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from './Screen';
import { PrimaryButton } from './PrimaryButton';
import { Wordmark } from './wordmark';
import { radius, space, type, useTheme } from '../theme';
import { usePhoneAuth } from '../hooks/usePhoneAuth';
import {
  CALLING_CODES,
  defaultCallingCode,
  isValidE164,
  splitPastedNumber,
  toE164,
} from '../utils/phone';

type Props = {
  title: string;
  body: string;
  footerLabel: string;
  footerAction: string;
  footerHref: '/(auth)/sign-in' | '/(auth)/create-account';
};

export function PhoneAuthForm({ title, body, footerLabel, footerAction, footerHref }: Props) {
  const theme = useTheme();
  const auth = usePhoneAuth();
  const [callingCode, setCallingCode] = useState(defaultCallingCode);
  const [national, setNational] = useState('');
  const [code, setCode] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const submittedCode = useRef('');

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  const phone = toE164(callingCode, national);
  const phoneReady = isValidE164(phone);
  const codeReady = /^\d{6}$/.test(code);

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CALLING_CODES;
    return CALLING_CODES.filter(
      (item) => item.name.toLowerCase().includes(q) || item.code.includes(q.replace(/\s/g, ''))
    );
  }, [query]);

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
          <Text style={{ color: theme.text, fontWeight: '700' }}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Wordmark theme={theme} />
          <Text style={[type.display, { color: theme.text }]}>
            {auth.step === 'code' ? 'Enter the code' : title}
          </Text>
          <Text style={[type.body, { color: theme.muted }]}>
            {auth.step === 'code' ? `We sent a 6-digit code to ${phone}.` : body}
          </Text>
        </View>

        {auth.error ? <Text style={{ color: theme.danger }}>{auth.error}</Text> : null}

        {auth.step === 'phone' ? (
          <View style={styles.phoneRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Country code"
              onPress={() => setPickerOpen(true)}
              style={[styles.codeBtn, { backgroundColor: theme.card }]}
            >
              <Text style={[styles.codeText, { color: theme.text }]}>{callingCode}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.muted} />
            </Pressable>
            <TextInput
              value={national}
              onChangeText={(value) => {
                const split = splitPastedNumber(value, callingCode);
                if (value.trim().startsWith('+') && split.national) {
                  setCallingCode(split.code);
                  setNational(split.national);
                  return;
                }
                setNational(split.national);
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="Mobile number"
              placeholderTextColor={theme.quiet}
              style={[styles.input, styles.national, { color: theme.text, backgroundColor: theme.card }]}
            />
          </View>
        ) : (
          <TextInput
            value={code}
            onChangeText={(value) => {
              const next = value.replace(/\D/g, '').slice(0, 6);
              setCode(next);
              if (next.length === 6 && !auth.loading && submittedCode.current !== next) {
                submittedCode.current = next;
                Haptics.selectionAsync();
                auth.confirmCode(next);
              }
            }}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            placeholder="000000"
            placeholderTextColor={theme.quiet}
            maxLength={6}
            style={[styles.input, styles.otp, { color: theme.text, backgroundColor: theme.card }]}
          />
        )}

        {auth.step === 'phone' ? (
          <PrimaryButton
            title="Send code"
            theme={theme}
            disabled={!phoneReady}
            loading={auth.loading}
            onPress={() => auth.sendCode(phone)}
          />
        ) : (
          <View style={{ gap: space[8] }}>
            <PrimaryButton
              title="Verify"
              theme={theme}
              disabled={!codeReady}
              loading={auth.loading}
              onPress={() => auth.confirmCode(code)}
            />
            <PrimaryButton
              title={auth.resendIn > 0 ? `Resend in ${auth.resendIn}s` : 'Resend code'}
              theme={theme}
              variant="ghost"
              disabled={auth.resendIn > 0 || auth.loading}
              onPress={() => {
                setCode('');
                submittedCode.current = '';
                auth.resend();
              }}
            />
            <Pressable
              onPress={() => {
                submittedCode.current = '';
                setCode('');
                auth.changeNumber();
              }}
              style={styles.footer}
            >
              <Text style={{ color: theme.accent, fontWeight: '700' }}>Use a different number</Text>
            </Pressable>
          </View>
        )}

        {auth.step === 'phone' ? (
          <Pressable onPress={() => router.push(footerHref)} style={styles.footer}>
            <Text style={{ color: theme.muted }}>
              {footerLabel} <Text style={{ color: theme.accent, fontWeight: '700' }}>{footerAction}</Text>
            </Text>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Screen theme={theme}>
          <View style={styles.picker}>
            <Pressable onPress={() => setPickerOpen(false)} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
              <Text style={{ color: theme.text, fontWeight: '700' }}>Country</Text>
            </Pressable>
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              placeholder="Search country or code"
              placeholderTextColor={theme.quiet}
              style={[styles.input, { color: theme.text, backgroundColor: theme.card, marginTop: 48 }]}
            />
            <FlatList
              data={countries}
              keyExtractor={(item) => `${item.code}-${item.name}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCallingCode(item.code);
                    setPickerOpen(false);
                    setQuery('');
                  }}
                  style={styles.countryRow}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: theme.muted }}>{item.code}</Text>
                </Pressable>
              )}
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[24], paddingBottom: space[12], justifyContent: 'center', gap: space[16] },
  back: { flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 8, left: space[24], zIndex: 2, minHeight: 44 },
  hero: { gap: space[8], marginBottom: space[8] },
  phoneRow: { flexDirection: 'row', gap: space[8] },
  codeBtn: {
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeText: { fontSize: 16, fontWeight: '700' },
  national: { flex: 1 },
  input: { borderRadius: radius.md, padding: space[16], minHeight: 52, fontSize: 16 },
  otp: { letterSpacing: 8, fontSize: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
  footer: { alignItems: 'center', paddingTop: space[4], minHeight: 44, justifyContent: 'center' },
  picker: { flex: 1, paddingHorizontal: space[24], paddingTop: space[8] },
  countryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
