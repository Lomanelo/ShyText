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
import { OtpSlots } from './OtpSlots';
import { PressScale } from './PressScale';
import { radius, space, type, useTheme } from '../theme';
import { usePhoneAuth } from '../hooks/usePhoneAuth';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        </Pressable>

        <View style={styles.hero}>
          <Wordmark theme={theme} />
          <Text style={[type.display, { color: theme.text }]}>
            {auth.step === 'code' ? t('auth.enterCode') : title}
          </Text>
          {auth.step === 'code' ? (
            <Text style={[type.body, { color: theme.muted }]}>{t('auth.sentTo', { phone })}</Text>
          ) : (
            <Text style={[type.caption, { color: theme.quiet }]}>{body}</Text>
          )}
        </View>

        {auth.error ? <Text style={{ color: theme.danger }}>{auth.error}</Text> : null}

        {auth.step === 'phone' ? (
          <View style={styles.phoneRow}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={t('auth.countryCode')}
              onPress={() => setPickerOpen(true)}
              style={[styles.codeBtn, { backgroundColor: theme.card }]}
            >
              <Text style={[styles.codeText, { color: theme.text }]}>{callingCode}</Text>
              <Ionicons name="chevron-down" size={14} color={theme.muted} />
            </PressScale>
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
              autoCorrect={false}
              returnKeyType="done"
              placeholder={t('auth.phone')}
              placeholderTextColor={theme.quiet}
              style={[styles.national, { color: theme.text }]}
            />
          </View>
        ) : (
          <OtpSlots
            value={code}
            theme={theme}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6 && !auth.loading && submittedCode.current !== next) {
                submittedCode.current = next;
                Haptics.selectionAsync();
                auth.confirmCode(next);
              }
            }}
          />
        )}

        <View style={{ flex: 1 }} />

        {auth.step === 'phone' ? (
          <View style={styles.dock}>
            <PrimaryButton
              title={t('auth.sendCode')}
              theme={theme}
              disabled={!phoneReady}
              loading={auth.loading}
              onPress={() => auth.sendCode(phone)}
            />
            <Pressable onPress={() => router.push(footerHref)} style={styles.footer}>
              <Text style={{ color: theme.muted }}>
                {footerLabel} <Text style={{ color: theme.accent, fontWeight: '700' }}>{footerAction}</Text>
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.dock}>
            <PrimaryButton
              title={t('auth.verify')}
              theme={theme}
              disabled={!codeReady}
              loading={auth.loading}
              onPress={() => auth.confirmCode(code)}
            />
            <PrimaryButton
              title={auth.resendIn > 0 ? t('auth.resendIn', { seconds: auth.resendIn }) : t('auth.resendCode')}
              theme={theme}
              variant="secondary"
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
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{t('auth.differentNumber')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Screen theme={theme}>
          <View style={styles.picker}>
            <View style={styles.pickerHead}>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={[styles.close, { backgroundColor: theme.card }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
              <Text style={[type.headline, { color: theme.text }]}>{t('auth.country')}</Text>
              <View style={{ width: 36 }} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              placeholder={t('common.search')}
              placeholderTextColor={theme.quiet}
              style={[styles.search, { color: theme.text, backgroundColor: theme.card }]}
            />
            <View style={[styles.countryCard, { backgroundColor: theme.card }]}>
              <FlatList
                data={countries}
                keyExtractor={(item) => `${item.code}-${item.name}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => {
                      setCallingCode(item.code);
                      setPickerOpen(false);
                      setQuery('');
                    }}
                    style={[
                      styles.countryRow,
                      index < countries.length - 1
                        ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                        : null,
                    ]}
                  >
                    <Text style={[type.body, { color: theme.text, flex: 1 }]}>{item.name}</Text>
                    <Text style={[type.body, { color: theme.muted }]}>{item.code}</Text>
                    {item.code === callingCode ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accent} style={{ marginLeft: 8 }} />
                    ) : null}
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[24], paddingBottom: space[12], paddingTop: 52 },
  back: { position: 'absolute', top: 8, left: space[16], zIndex: 2, width: 44, height: 44, justifyContent: 'center' },
  hero: { gap: space[8], marginBottom: space[16] },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  codeBtn: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space[12],
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeText: { fontSize: 17, fontWeight: '700' },
  national: { flex: 1, minHeight: 52, fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  dock: { gap: space[8], paddingBottom: space[8] },
  footer: { alignItems: 'center', paddingTop: space[4], minHeight: 44, justifyContent: 'center' },
  picker: { flex: 1, paddingHorizontal: space[16], paddingTop: space[8], gap: space[12] },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: { borderRadius: radius.pill, borderCurve: 'continuous', paddingHorizontal: space[16], minHeight: 44, fontSize: 17 },
  countryCard: { flex: 1, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  countryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16] },
});
