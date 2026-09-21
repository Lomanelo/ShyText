import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { PressScale } from '../../components/PressScale';
import { SearchSelectModal } from '../../components/SearchSelectModal';
import { radius, space, type, useTheme } from '../../theme';
import {
  getOwnPrivateProfile,
  removeOwnAvatar,
  savePrivateProfile,
  updateOwnProfile,
  uploadAvatar,
} from '../../services/auth';
import { userFacingError } from '../../utils/userError';
import { useAuth } from '../../hooks/useAuth';
import { MAX_BIO_LENGTH } from '../../utils/config';
import {
  countryCodeFromName,
  countryName,
  defaultCountryCode,
  listCities,
  listCountries,
} from '../../utils/geo';
import { useTranslation } from 'react-i18next';

type PickerKind = 'country' | 'city' | null;

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { profile, refreshProfile, user } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [pickedUri, setPickedUri] = useState<string>();
  const [removed, setRemoved] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [savedCountryCode, setSavedCountryCode] = useState('');
  const [savedCity, setSavedCity] = useState('');
  const [picker, setPicker] = useState<PickerKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Flip after a successful save so usePreventRemove unlocks before router.back(). */
  const [leaveAllowed, setLeaveAllowed] = useState(false);
  const bioRef = useRef<TextInput>(null);
  /** True after the form has been filled from Firestore (not Auth-only). */
  const hydrated = useRef(false);

  const countries = useMemo(() => listCountries(i18n.language), [i18n.language]);
  const cities = useMemo(() => listCities(countryCode || defaultCountryCode()), [countryCode]);
  const countryLabel = countryCode ? countryName(countryCode, i18n.language) : '';

  const hydrateFromProfile = useCallback(() => {
    if (!profile) return;
    setName(profile.displayName?.trim() || user?.displayName || '');
    setBio(profile.bio?.trim() || '');
    setPickedUri(undefined);
    setRemoved(false);
    setLeaveAllowed(false);
    hydrated.current = true;
  }, [profile, user?.displayName]);

  const hydratePrivate = useCallback(async () => {
    const priv = await getOwnPrivateProfile();
    if (!priv) return;
    const nextCountry =
      priv.countryCode ||
      countryCodeFromName(priv.country, i18n.language) ||
      '';
    const nextCity = priv.city?.trim() || '';
    setCountryCode(nextCountry);
    setCity(nextCity);
    setSavedCountryCode(nextCountry);
    setSavedCity(nextCity);
  }, [i18n.language]);

  const displayUri = removed ? undefined : pickedUri ?? profile?.avatarUrl;
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const profileName = profile?.displayName?.trim() || '';
  const profileBio = profile?.bio?.trim() || '';
  const dirty =
    trimmedName !== profileName ||
    trimmedBio !== profileBio ||
    Boolean(pickedUri) ||
    removed ||
    countryCode !== savedCountryCode ||
    city !== savedCity;
  const canSave = dirty && trimmedName.length >= 2 && !busy;
  const blockLeave = dirty && !busy && !leaveAllowed;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Wait for the Firestore profile — never lock in empty bio from Auth-only seed.
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrateFromProfile();
    void hydratePrivate();
  }, [profile, hydrateFromProfile, hydratePrivate]);

  // Re-entering the screen reloads saved values; skip if the user has local edits.
  useFocusEffect(
    useCallback(() => {
      if (!profile || dirtyRef.current) return;
      hydrateFromProfile();
      void hydratePrivate();
    }, [profile, hydrateFromProfile, hydratePrivate])
  );

  // Native-stack safe discard guard (replaces beforeRemove + preventDefault).
  usePreventRemove(blockLeave, ({ data }) => {
    Alert.alert(t('profile.discardTitle'), t('profile.discardBody'), [
      { text: t('profile.keepEditing'), style: 'cancel' },
      {
        text: t('profile.discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // Leave only after the guard has unlocked on the next render.
  useEffect(() => {
    if (!leaveAllowed) return;
    router.back();
  }, [leaveAllowed]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('errors.photoPermissionChange'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPickedUri(result.assets[0].uri);
      setRemoved(false);
      setError(null);
    }
  };

  const onPhotoPress = () => {
    const hasPhoto = Boolean(displayUri);
    Alert.alert(t('profile.photoTitle'), undefined, [
      { text: t('profile.choosePhoto'), onPress: () => void pickPhoto() },
      ...(hasPhoto
        ? [
            {
              text: t('profile.remove'),
              style: 'destructive' as const,
              onPress: () => {
                setPickedUri(undefined);
                setRemoved(true);
              },
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      if (removed) {
        await removeOwnAvatar();
      } else if (pickedUri) {
        const avatarUrl = await uploadAvatar(pickedUri);
        await updateOwnProfile({ avatarUrl });
      }
      await updateOwnProfile({ displayName: trimmedName, bio: trimmedBio || null });
      await savePrivateProfile({
        city: city || undefined,
        country: countryLabel || undefined,
        countryCode: countryCode || undefined,
      });
      await refreshProfile();
      setPickedUri(undefined);
      setRemoved(false);
      setSavedCountryCode(countryCode);
      setSavedCity(city);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLeaveAllowed(true);
    } catch (err) {
      setError(userFacingError(err, t('errors.saveProfile')));
    } finally {
      setBusy(false);
    }
  };

  const selectRow = (label: string, value: string, onPress: () => void, placeholder: string) => (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.selectRow, { backgroundColor: theme.card }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.caption, { color: theme.quiet }]}>{label}</Text>
        <Text style={[type.body, { color: value ? theme.text : theme.quiet }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.quiet} />
    </PressScale>
  );

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen
        options={{
          title: t('profile.edit'),
          // Required with usePreventRemove so iOS back-menu can't skip the guard.
          headerBackButtonMenuEnabled: false,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
              onPress={() => void save()}
              disabled={!canSave}
              hitSlop={12}
            >
              <Text
                style={[
                  type.headline,
                  { color: theme.accent, opacity: canSave ? 1 : 0.35 },
                ]}
              >
                {busy ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={onPhotoPress} style={styles.photo} accessibilityLabel={t('profile.changePhotoA11y')}>
            <Avatar name={trimmedName || profile?.displayName} uri={displayUri} userId={profile?.id} theme={theme} size={96} />
            <Text style={[type.headline, { color: theme.accent, marginTop: 10 }]}>
              {displayUri ? t('profile.changePhoto') : t('auth.addPhoto')}
            </Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('auth.firstName')}
            placeholderTextColor={theme.quiet}
            autoComplete="name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
            maxLength={40}
            onSubmitEditing={() => bioRef.current?.focus()}
            style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
          />
          <TextInput
            ref={bioRef}
            value={bio}
            onChangeText={setBio}
            placeholder={t('profile.oneLiner')}
            placeholderTextColor={theme.quiet}
            maxLength={MAX_BIO_LENGTH}
            returnKeyType="done"
            multiline
            style={[styles.input, styles.bio, { color: theme.text, backgroundColor: theme.card }]}
          />
          <Text style={[type.caption, { color: theme.quiet, textAlign: 'right' }]}>
            {bio.length}/{MAX_BIO_LENGTH}
          </Text>

          <View style={styles.privateBlock}>
            <Text style={[type.headline, { color: theme.text }]}>{t('profile.privateSection')}</Text>
            <Text style={[type.caption, { color: theme.quiet }]}>{t('profile.privateSectionHint')}</Text>
            {selectRow(t('auth.country'), countryLabel, () => setPicker('country'), t('auth.selectCountry'))}
            {selectRow(t('auth.city'), city, () => setPicker('city'), t('auth.selectCity'))}
          </View>

          {error ? <Text style={[type.body, { color: theme.danger }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <SearchSelectModal
        visible={picker === 'country'}
        title={t('auth.selectCountry')}
        theme={theme}
        options={countries.map((c) => ({ id: c.code, label: c.name }))}
        selectedId={countryCode || undefined}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          setCountryCode(option.id);
          setCity('');
          void Haptics.selectionAsync();
        }}
      />
      <SearchSelectModal
        visible={picker === 'city'}
        title={t('auth.selectCity')}
        theme={theme}
        options={cities.map((c) => ({ id: c.id, label: c.name }))}
        selectedId={city && countryCode ? `${countryCode}:${city}` : undefined}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          setCity(option.label);
          void Haptics.selectionAsync();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space[16], gap: space[12], paddingBottom: 40 },
  photo: { alignItems: 'center', paddingVertical: space[16] },
  input: { borderRadius: radius.md, padding: space[16], minHeight: 52, fontSize: 17 },
  bio: { minHeight: 96, textAlignVertical: 'top' },
  privateBlock: { gap: space[12], marginTop: space[8] },
  selectRow: {
    minHeight: 64,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
});
