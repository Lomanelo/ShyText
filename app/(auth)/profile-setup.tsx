import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Localization from 'expo-localization';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PressScale } from '../../components/PressScale';
import { Avatar } from '../../components/Avatar';
import { motion, radius, space, type, useTheme, type Theme } from '../../theme';
import { ageFromBirthDate, completeProfile, uploadAvatar } from '../../services/auth';
import { HOW_IT_WORKS_SEEN_KEY } from '../../utils/walkthrough';
import { useAuth } from '../../hooks/useAuth';
import { Gender } from '../../types/user';
import { MAX_BIO_LENGTH } from '../../utils/config';
import { useTranslation } from 'react-i18next';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const STEPS = 3;

function defaultCountry(language: string): string {
  try {
    const region = Localization.getLocales()[0]?.regionCode;
    if (!region) return '';
    return new Intl.DisplayNames([language], { type: 'region' }).of(region) ?? '';
  } catch {
    return '';
  }
}

function FieldGroup({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <View style={[styles.group, { backgroundColor: theme.card }]}>{children}</View>
  );
}

function FieldRow({
  theme,
  label,
  last,
  children,
}: {
  theme: Theme;
  label: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.fieldRow,
        !last
          ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
          : null,
      ]}
    >
      <Text style={[styles.fieldLabel, { color: theme.quiet }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(() => defaultCountry(i18n.language));
  const [nationality, setNationality] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  const nationalityRef = useRef<TextInput>(null);

  const birthDate = useMemo(() => {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!d || !m || !y || year.length < 4 || d > 31 || m > 12 || y < 1900) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }, [day, month, year]);

  const age = birthDate ? ageFromBirthDate(birthDate) : undefined;
  const birthdayComplete = day.length > 0 && month.length > 0 && year.length === 4;
  const underage = birthdayComplete && birthDate != null && age == null;

  const stepReady =
    step === 0
      ? name.trim().length >= 2
      : step === 1
        ? age != null && gender != null
        : EMAIL_RE.test(email.trim());

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('errors.photoPermissionAdd'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      void Haptics.selectionAsync();
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;
      if (photoUri) {
        avatarUrl = await uploadAvatar(photoUri);
      }
      await completeProfile(name.trim(), avatarUrl, bio.trim() || undefined, age, {
        gender: gender ?? undefined,
        birthDate: birthDate ?? undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        nationality: nationality.trim() || undefined,
      });
      await refreshProfile();
      await AsyncStorage.setItem(HOW_IT_WORKS_SEEN_KEY, '1').catch(() => undefined);
      router.replace('/how-it-works?first=1');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('storage/')
          ? t('errors.photoUploadOrSkip')
          : message.includes('permission') || message.includes('insufficient')
            ? t('errors.profilePermission')
            : message || t('errors.saveProfile')
      );
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (step <= 0) return;
    void Haptics.selectionAsync();
    setError(null);
    setStep(step - 1);
  };

  const next = () => {
    setError(null);
    if (step < STEPS - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(step + 1);
      return;
    }
    void finish();
  };

  const fieldInput = [styles.fieldInput, { color: theme.text }];

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.top}>
          <View style={styles.progressRow}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                onPress={goBack}
                hitSlop={12}
                style={styles.back}
              >
                <Ionicons name="chevron-back" size={22} color={theme.accent} />
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <View style={styles.bars}>
              {Array.from({ length: STEPS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.barTrack,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: theme.accent,
                        // Completed + current steps are fully filled; upcoming stay empty.
                        width: i <= step ? '100%' : '0%',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.stepCount, { color: theme.quiet }]}>
              {step + 1}/{STEPS}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces
        >
          <Animated.View
            key={step}
            entering={FadeInUp.duration(motion.enter).easing(Easing.out(Easing.cubic))}
            style={styles.step}
          >
            {step === 0 ? (
              <>
                <View style={styles.copy}>
                  <Text style={[type.display, { color: theme.text }]}>{t('auth.setupTitle')}</Text>
                  <Text style={[type.body, { color: theme.muted }]}>{t('auth.publicOnly')}</Text>
                </View>

                <PressScale
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.addPhotoA11y')}
                  style={styles.photoWrap}
                >
                  <View style={[styles.photoRing, { borderColor: theme.accentSoft }]}>
                    {photoUri ? (
                      <Avatar name={name} uri={photoUri} theme={theme} size={112} />
                    ) : (
                      <View
                        style={[
                          styles.photoEmpty,
                          { backgroundColor: theme.accentSoft, borderColor: theme.imageOutline },
                        ]}
                      >
                        <Ionicons name="person" size={44} color={theme.accent} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.cameraBadge,
                        { backgroundColor: theme.accent, borderColor: theme.bg as string },
                      ]}
                    >
                      <Ionicons name={photoUri ? 'pencil' : 'camera'} size={15} color={theme.onAccent} />
                    </View>
                  </View>
                  <Text style={[styles.photoHint, { color: theme.accent }]}>
                    {photoUri ? t('profile.changePhoto') : t('auth.addPhoto')}
                  </Text>
                </PressScale>

                <FieldGroup theme={theme}>
                  <FieldRow theme={theme} label={t('auth.firstName')}>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={t('auth.firstNameHint')}
                      placeholderTextColor={theme.quiet}
                      autoComplete="name"
                      textContentType="givenName"
                      autoCapitalize="words"
                      autoFocus
                      returnKeyType="next"
                      onSubmitEditing={() => bioRef.current?.focus()}
                      style={fieldInput}
                    />
                  </FieldRow>
                  <FieldRow theme={theme} label={t('auth.oneLinerLabel')} last>
                    <TextInput
                      ref={bioRef}
                      value={bio}
                      onChangeText={setBio}
                      placeholder={t('auth.oneLinerOptional')}
                      placeholderTextColor={theme.quiet}
                      maxLength={MAX_BIO_LENGTH}
                      returnKeyType="done"
                      style={fieldInput}
                    />
                  </FieldRow>
                </FieldGroup>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <View style={styles.copy}>
                  <Text style={[type.display, { color: theme.text }]}>{t('auth.birthdayTitle')}</Text>
                  <Text style={[type.body, { color: theme.muted }]}>{t('auth.birthdaySub')}</Text>
                </View>

                <FieldGroup theme={theme}>
                  <View style={styles.dobCard}>
                    <View style={styles.dobCol}>
                      <Text style={[styles.fieldLabel, { color: theme.quiet, textAlign: 'center' }]}>
                        {t('auth.day')}
                      </Text>
                      <TextInput
                        value={day}
                        onChangeText={(v) => {
                          const clean = v.replace(/\D/g, '').slice(0, 2);
                          setDay(clean);
                          if (clean.length === 2) monthRef.current?.focus();
                        }}
                        placeholder="08"
                        placeholderTextColor={theme.quiet}
                        keyboardType="number-pad"
                        maxLength={2}
                        autoFocus
                        style={[styles.dobInput, { color: theme.text }]}
                      />
                    </View>
                    <View style={[styles.dobDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.dobCol}>
                      <Text style={[styles.fieldLabel, { color: theme.quiet, textAlign: 'center' }]}>
                        {t('auth.month')}
                      </Text>
                      <TextInput
                        ref={monthRef}
                        value={month}
                        onChangeText={(v) => {
                          const clean = v.replace(/\D/g, '').slice(0, 2);
                          setMonth(clean);
                          if (clean.length === 2) yearRef.current?.focus();
                        }}
                        placeholder="03"
                        placeholderTextColor={theme.quiet}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={[styles.dobInput, { color: theme.text }]}
                      />
                    </View>
                    <View style={[styles.dobDivider, { backgroundColor: theme.border }]} />
                    <View style={[styles.dobCol, { flex: 1.35 }]}>
                      <Text style={[styles.fieldLabel, { color: theme.quiet, textAlign: 'center' }]}>
                        {t('auth.year')}
                      </Text>
                      <TextInput
                        ref={yearRef}
                        value={year}
                        onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1998"
                        placeholderTextColor={theme.quiet}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={[styles.dobInput, { color: theme.text }]}
                      />
                    </View>
                  </View>
                </FieldGroup>

                {underage ? (
                  <Text style={[type.caption, { color: theme.danger }]}>{t('auth.ageError')}</Text>
                ) : age != null ? (
                  <Text style={[type.caption, { color: theme.muted }]}>
                    {t('auth.agePreview', { age })}
                  </Text>
                ) : null}

                <Text style={[type.headline, { color: theme.text, marginTop: space[8] }]}>
                  {t('auth.genderTitle')}
                </Text>
                <View style={styles.genderRow}>
                  {(['female', 'male'] as const).map((option) => {
                    const active = gender === option;
                    return (
                      <PressScale
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setGender(option);
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.genderCard,
                          {
                            backgroundColor: active ? theme.accentSoft : theme.card,
                            borderColor: active ? theme.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            type.headline,
                            { color: active ? theme.accent : theme.text },
                          ]}
                        >
                          {t(`auth.${option}`)}
                        </Text>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                        ) : (
                          <View style={[styles.genderDot, { borderColor: theme.border }]} />
                        )}
                      </PressScale>
                    );
                  })}
                </View>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <View style={styles.copy}>
                  <Text style={[type.display, { color: theme.text }]}>{t('auth.detailsTitle')}</Text>
                  <Text style={[type.body, { color: theme.muted }]}>{t('auth.detailsSub')}</Text>
                </View>

                <FieldGroup theme={theme}>
                  <FieldRow theme={theme} label={t('auth.email')}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder={t('auth.emailHint')}
                      placeholderTextColor={theme.quiet}
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="next"
                      onSubmitEditing={() => cityRef.current?.focus()}
                      style={fieldInput}
                    />
                  </FieldRow>
                  <FieldRow theme={theme} label={t('auth.city')}>
                    <TextInput
                      ref={cityRef}
                      value={city}
                      onChangeText={setCity}
                      placeholder={t('auth.cityHint')}
                      placeholderTextColor={theme.quiet}
                      autoCapitalize="words"
                      textContentType="addressCity"
                      returnKeyType="next"
                      onSubmitEditing={() => countryRef.current?.focus()}
                      style={fieldInput}
                    />
                  </FieldRow>
                  <FieldRow theme={theme} label={t('auth.countryResidence')}>
                    <TextInput
                      ref={countryRef}
                      value={country}
                      onChangeText={setCountry}
                      placeholder={t('auth.countryHint')}
                      placeholderTextColor={theme.quiet}
                      autoCapitalize="words"
                      textContentType="countryName"
                      returnKeyType="next"
                      onSubmitEditing={() => nationalityRef.current?.focus()}
                      style={fieldInput}
                    />
                  </FieldRow>
                  <FieldRow theme={theme} label={t('auth.nationality')} last>
                    <TextInput
                      ref={nationalityRef}
                      value={nationality}
                      onChangeText={setNationality}
                      placeholder={t('auth.nationalityHint')}
                      placeholderTextColor={theme.quiet}
                      autoCapitalize="words"
                      returnKeyType="done"
                      style={fieldInput}
                    />
                  </FieldRow>
                </FieldGroup>

                {email.length > 3 && !EMAIL_RE.test(email.trim()) ? (
                  <Text style={[type.caption, { color: theme.danger }]}>{t('auth.emailError')}</Text>
                ) : null}

                <View style={[styles.privacyNote, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="lock-closed" size={15} color={theme.accent} />
                  <Text style={[type.caption, { color: theme.muted, flex: 1 }]}>
                    {t('auth.privateNote')}
                  </Text>
                </View>
              </>
            ) : null}
          </Animated.View>

          {error ? <Text style={[type.caption, { color: theme.danger }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.dock, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
          <PrimaryButton
            title={step < STEPS - 1 ? t('common.continue') : t('auth.finish')}
            theme={theme}
            disabled={!stepReady}
            loading={busy}
            onPress={next}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: space[24], paddingTop: space[8] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepCount: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 28,
    textAlign: 'right',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space[24],
    paddingTop: space[16],
    paddingBottom: space[24],
    gap: space[16],
  },
  step: { gap: space[16] },
  copy: { gap: space[8] },
  photoWrap: { alignSelf: 'center', alignItems: 'center', gap: space[8], paddingVertical: space[4] },
  photoRing: {
    padding: 5,
    borderRadius: 999,
    borderWidth: 2,
  },
  photoEmpty: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  photoHint: { fontSize: 15, fontWeight: '700' },
  group: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  fieldRow: {
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingBottom: space[12],
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    minHeight: 28,
    padding: 0,
  },
  dobCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: space[12],
    paddingHorizontal: space[8],
  },
  dobCol: { flex: 1, gap: 6 },
  dobDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  dobInput: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    minHeight: 40,
    padding: 0,
  },
  genderRow: { gap: space[12] },
  genderCard: {
    minHeight: 56,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genderDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  dock: {
    paddingHorizontal: space[24],
    paddingTop: space[12],
    paddingBottom: space[12],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
