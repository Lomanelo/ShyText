import { useEffect, useMemo, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PressScale } from '../../components/PressScale';
import { Avatar } from '../../components/Avatar';
import { SearchSelectModal } from '../../components/SearchSelectModal';
import { motion, radius, space, type, useTheme } from '../../theme';
import { ageFromBirthDate, completeProfile, uploadAvatar } from '../../services/auth';
import { userFacingError } from '../../utils/userError';
import { HOW_IT_WORKS_SEEN_KEY } from '../../utils/walkthrough';
import { useAuth } from '../../hooks/useAuth';
import { GENDER_OPTIONS, Gender } from '../../types/user';
import {
  countryName,
  defaultCountryCode,
  listCities,
  listCountries,
} from '../../utils/geo';
import { useTranslation } from 'react-i18next';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type StepId = 'birthday' | 'name' | 'gender' | 'photo' | 'email' | 'city';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { user, refreshProfile } = useAuth();

  const authEmail = user?.email?.trim() || '';
  const needsEmail = !EMAIL_RE.test(authEmail);

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['birthday', 'name', 'gender', 'photo'];
    if (needsEmail) list.push('email');
    list.push('city');
    return list;
  }, [needsEmail]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState(authEmail);
  const [countryCode, setCountryCode] = useState(() => defaultCountryCode());
  const [city, setCity] = useState('');
  const [suggestedCity, setSuggestedCity] = useState<string | null>(null);
  const [detectingCity, setDetectingCity] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const cityDetected = useRef(false);

  // Keep step index valid if email step appears/disappears.
  useEffect(() => {
    if (step >= steps.length) setStep(steps.length - 1);
  }, [step, steps.length]);

  const stepId = steps[Math.min(step, steps.length - 1)];
  const cities = useMemo(() => listCities(countryCode), [countryCode]);
  const countries = useMemo(() => listCountries(i18n.language), [i18n.language]);
  const countryLabel = countryName(countryCode, i18n.language);

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

  const stepReady = (() => {
    switch (stepId) {
      case 'birthday':
        return age != null;
      case 'name':
        return name.trim().length >= 2;
      case 'gender':
        return true; // optional
      case 'photo':
        return true; // skippable
      case 'email':
        return EMAIL_RE.test(email.trim());
      case 'city':
        return Boolean(city);
      default:
        return false;
    }
  })();

  // Infer city (and refine country) from location when we land on the city step.
  useEffect(() => {
    if (stepId !== 'city' || cityDetected.current) return;
    cityDetected.current = true;
    let cancelled = false;
    (async () => {
      setDetectingCity(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const place = places[0];
        if (!place || cancelled) return;
        const iso = place.isoCountryCode?.toUpperCase();
        if (iso && countries.some((c) => c.code === iso)) {
          setCountryCode(iso);
        }
        const detected =
          place.city || place.subregion || place.district || place.region || '';
        if (detected) {
          setSuggestedCity(detected);
          setCity((prev) => prev || detected);
        }
      } catch {
        // Location optional — user can still pick from the list.
      } finally {
        if (!cancelled) setDetectingCity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countries, stepId]);

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
      const resolvedEmail = needsEmail ? email.trim() : authEmail || undefined;
      // Age stays private — never published on the public profile by default.
      await completeProfile(name.trim(), avatarUrl, undefined, undefined, {
        gender: gender ?? undefined,
        birthDate: birthDate ?? undefined,
        email: resolvedEmail,
        city: city || undefined,
        country: countryLabel || undefined,
        countryCode: countryCode || undefined,
      });
      await refreshProfile();
      await AsyncStorage.setItem(HOW_IT_WORKS_SEEN_KEY, '1').catch(() => undefined);
      router.replace('/how-it-works?first=1');
    } catch (err) {
      setError(userFacingError(err, t('errors.saveProfile')));
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
    if (step < steps.length - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(step + 1);
      return;
    }
    void finish();
  };

  const selectGender = (option: Gender) => {
    setGender(option);
    void Haptics.selectionAsync();
  };

  const title = t(`auth.step.${stepId}.title`);
  const body = t(`auth.step.${stepId}.body`);

  const cityOptions = useMemo(() => {
    const base = cities.map((c) => ({ id: c.id, label: c.name }));
    if (suggestedCity && !base.some((c) => c.label.toLowerCase() === suggestedCity.toLowerCase())) {
      return [{ id: `detected:${suggestedCity}`, label: suggestedCity }, ...base];
    }
    return base;
  }, [cities, suggestedCity]);

  const primaryTitle = (() => {
    if (step === steps.length - 1) {
      return busy ? t('common.saving') : t('common.continue');
    }
    if (stepId === 'gender' && !gender) return t('common.skip');
    if (stepId === 'photo' && !photoUri) return t('common.skip');
    return t('common.continue');
  })();

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
              {steps.map((_, i) => (
                <View key={i} style={[styles.barTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: theme.accent,
                        width: i <= step ? '100%' : '0%',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.stepCount, { color: theme.quiet }]}>
              {step + 1}/{steps.length}
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
            key={stepId}
            entering={FadeInRight.duration(motion.enter).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutLeft.duration(160)}
            style={styles.step}
          >
            <View style={styles.copy}>
              <Text style={[type.display, { color: theme.text }]}>{title}</Text>
              <Text style={[type.body, { color: theme.muted }]}>{body}</Text>
            </View>

            {stepId === 'birthday' ? (
              <>
                <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
                  <View style={styles.dobCard}>
                    <View style={styles.dobCol}>
                      <Text style={[styles.dobLabel, { color: theme.quiet }]}>{t('auth.day')}</Text>
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
                        style={[styles.dobInput, { color: theme.text }]}
                      />
                    </View>
                    <View style={[styles.dobDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.dobCol}>
                      <Text style={[styles.dobLabel, { color: theme.quiet }]}>{t('auth.month')}</Text>
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
                      <Text style={[styles.dobLabel, { color: theme.quiet }]}>{t('auth.year')}</Text>
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
                </View>
                {underage ? (
                  <Text style={[type.caption, { color: theme.danger }]}>{t('auth.ageError')}</Text>
                ) : null}
              </>
            ) : null}

            {stepId === 'name' ? (
              <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('auth.firstNameHint')}
                  placeholderTextColor={theme.quiet}
                  autoComplete="name"
                  textContentType="givenName"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => stepReady && next()}
                  style={[styles.soloInput, { color: theme.text }]}
                />
              </View>
            ) : null}

            {stepId === 'gender' ? (
              <View style={styles.genderCol}>
                {GENDER_OPTIONS.map((option) => {
                  const active = gender === option;
                  return (
                    <PressScale
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => selectGender(option)}
                      style={[
                        styles.genderCard,
                        {
                          backgroundColor: active ? theme.accentSoft : theme.card,
                          borderColor: active ? theme.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[type.headline, { color: active ? theme.accent : theme.text }]}>
                        {t(`auth.gender.${option}`)}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                      ) : (
                        <View style={[styles.genderDot, { borderColor: theme.border }]} />
                      )}
                    </PressScale>
                  );
                })}
              </View>
            ) : null}

            {stepId === 'photo' ? (
              <PressScale
                onPress={pickPhoto}
                accessibilityRole="button"
                accessibilityLabel={t('auth.addPhotoA11y')}
                style={styles.photoWrap}
              >
                <View style={[styles.photoRing, { borderColor: theme.accentSoft }]}>
                  {photoUri ? (
                    <Avatar name={name || t('common.you')} uri={photoUri} theme={theme} size={128} />
                  ) : (
                    <View
                      style={[
                        styles.photoEmpty,
                        { backgroundColor: theme.accentSoft, borderColor: theme.imageOutline },
                      ]}
                    >
                      <Ionicons name="person" size={48} color={theme.accent} />
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
            ) : null}

            {stepId === 'email' ? (
              <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailHint')}
                  placeholderTextColor={theme.quiet}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => stepReady && next()}
                  style={[styles.soloInput, { color: theme.text }]}
                />
              </View>
            ) : null}

            {stepId === 'city' ? (
              <View style={{ gap: space[12] }}>
                {detectingCity ? (
                  <Text style={[type.caption, { color: theme.quiet }]}>{t('auth.detectingCity')}</Text>
                ) : suggestedCity ? (
                  <Text style={[type.caption, { color: theme.muted }]}>
                    {t('auth.suggestedCity', { city: suggestedCity })}
                  </Text>
                ) : null}
                <PressScale
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.city')}
                  style={[styles.selectRow, { backgroundColor: theme.card }]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.caption, { color: theme.quiet }]}>{t('auth.city')}</Text>
                    <Text style={[type.body, { color: city ? theme.text : theme.quiet }]} numberOfLines={1}>
                      {city || t('auth.selectCity')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.quiet} />
                </PressScale>
              </View>
            ) : null}

            {error ? (
              <Text style={[type.caption, { color: theme.danger, textAlign: 'center' }]}>{error}</Text>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.dock}>
          <PrimaryButton
            title={primaryTitle}
            theme={theme}
            disabled={!stepReady || busy}
            loading={busy}
            onPress={next}
          />
        </View>
      </KeyboardAvoidingView>

      <SearchSelectModal
        visible={pickerOpen && stepId === 'city'}
        title={t('auth.selectCity')}
        theme={theme}
        options={cityOptions}
        selectedId={
          city
            ? cityOptions.find((c) => c.label === city)?.id ?? `detected:${city}`
            : undefined
        }
        onClose={() => setPickerOpen(false)}
        onSelect={(option) => {
          setCity(option.label);
          void Haptics.selectionAsync();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: space[16], paddingTop: space[8] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  stepCount: { ...type.caption, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space[16],
    paddingTop: space[24],
    paddingBottom: space[24],
    gap: space[24],
  },
  step: { gap: space[24] },
  copy: { gap: space[8] },
  photoWrap: { alignItems: 'center', gap: space[12], paddingVertical: space[16] },
  photoRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmpty: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { ...type.headline },
  fieldCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: space[16],
    paddingVertical: space[4],
  },
  soloInput: { fontSize: 22, lineHeight: 28, fontWeight: '600', paddingVertical: space[16] },
  dobCard: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: space[8] },
  dobCol: { flex: 1, alignItems: 'center', gap: 4 },
  dobLabel: { ...type.caption, textAlign: 'center' },
  dobInput: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 48,
    paddingVertical: space[8],
  },
  dobDivider: { width: StyleSheet.hairlineWidth, marginVertical: space[8] },
  genderCol: { gap: space[12] },
  genderCard: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genderDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  selectRow: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  dock: {
    paddingHorizontal: space[16],
    paddingBottom: space[16],
    paddingTop: space[8],
    gap: space[8],
  },
});
