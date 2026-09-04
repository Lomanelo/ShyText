import { useEffect, useRef, useState } from 'react';
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
import { Stack, router, useNavigation } from 'expo-router';
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
  const [name, setName] = useState(profile?.displayName ?? user?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [pickedUri, setPickedUri] = useState<string>();
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bioRef = useRef<TextInput>(null);
  const saved = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    const seedName = profile?.displayName ?? user?.displayName;
    if (!seedName && profile == null && !user?.displayName) return;
    if (profile || user?.displayName) {
      setName(seedName ?? '');
      setBio(profile?.bio ?? '');
      seeded.current = true;
    }
  }, [profile, user?.displayName]);

  const displayUri = removed ? undefined : pickedUri ?? profile?.avatarUrl;
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const dirty =
    trimmedName !== (profile?.displayName ?? '') ||
    trimmedBio !== (profile?.bio ?? '') ||
    Boolean(pickedUri) ||
    removed;
  const canSave = dirty && trimmedName.length >= 2 && !busy;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (event) => {
      if (!dirty || busy || saved.current) return;
      event.preventDefault();
      Alert.alert(t('profile.discardTitle'), t('profile.discardBody'), [
        { text: t('profile.keepEditing'), style: 'cancel' },
        {
          text: t('profile.discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
    return unsub;
  }, [busy, dirty, navigation]);

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
        ? [{ text: t('profile.remove'), style: 'destructive' as const, onPress: () => { setPickedUri(undefined); setRemoved(true); } }]
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
      saved.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
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
