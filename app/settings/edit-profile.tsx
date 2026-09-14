import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { radius, space, type, useTheme } from '../../theme';
import { removeOwnAvatar, updateOwnProfile, uploadAvatar } from '../../services/auth';
import { useAuth } from '../../hooks/useAuth';
import { MAX_BIO_LENGTH } from '../../utils/config';
import { useTranslation } from 'react-i18next';

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { profile, refreshProfile, user } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [pickedUri, setPickedUri] = useState<string>();
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Flip after a successful save so usePreventRemove unlocks before router.back(). */
  const [leaveAllowed, setLeaveAllowed] = useState(false);
  const bioRef = useRef<TextInput>(null);
  /** True after the form has been filled from Firestore (not Auth-only). */
  const hydrated = useRef(false);

  const hydrateFromProfile = useCallback(() => {
    if (!profile) return;
    setName(profile.displayName?.trim() || user?.displayName || '');
    setBio(profile.bio?.trim() || '');
    setPickedUri(undefined);
    setRemoved(false);
    setLeaveAllowed(false);
    hydrated.current = true;
  }, [profile, user?.displayName]);

  const displayUri = removed ? undefined : pickedUri ?? profile?.avatarUrl;
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const profileName = profile?.displayName?.trim() || '';
  const profileBio = profile?.bio?.trim() || '';
  const dirty =
    trimmedName !== profileName ||
    trimmedBio !== profileBio ||
    Boolean(pickedUri) ||
    removed;
  const canSave = dirty && trimmedName.length >= 2 && !busy;
  const blockLeave = dirty && !busy && !leaveAllowed;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Wait for the Firestore profile — never lock in empty bio from Auth-only seed.
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrateFromProfile();
  }, [profile, hydrateFromProfile]);

  // Re-entering the screen reloads saved values; skip if the user has local edits.
  useFocusEffect(
    useCallback(() => {
      if (!profile || dirtyRef.current) return;
      hydrateFromProfile();
    }, [profile, hydrateFromProfile])
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
      await refreshProfile();
      setPickedUri(undefined);
      setRemoved(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLeaveAllowed(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('storage/')
          ? t('errors.photoUpload')
          : message || t('errors.saveProfile')
      );
    } finally {
      setBusy(false);
    }
  };

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
          {error ? <Text style={[type.body, { color: theme.danger }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space[16], gap: space[12], paddingBottom: 40 },
  photo: { alignItems: 'center', paddingVertical: space[16] },
  input: { borderRadius: radius.md, padding: space[16], minHeight: 52, fontSize: 17 },
  bio: { minHeight: 96, textAlignVertical: 'top' },
});
