import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Avatar } from '../../components/Avatar';
import { radius, space, type, useTheme } from '../../theme';
import { completeProfile, sanitizeAge, uploadAvatar } from '../../services/auth';
import { useAuth } from '../../hooks/useAuth';
import { MAX_BIO_LENGTH } from '../../utils/config';
import { useTranslation } from 'react-i18next';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [ageText, setAgeText] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ageRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

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
    }
  };

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Text style={[type.display, { color: theme.text }]}>{t('auth.setupTitle')}</Text>
        <Pressable onPress={pickPhoto} style={{ alignSelf: 'center' }} accessibilityLabel={t('auth.addPhotoA11y')}>
          <Avatar name={name} uri={photoUri} theme={theme} size={88} />
          <Text style={{ color: theme.accent, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
            {t('auth.addPhoto')}
          </Text>
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('auth.firstName')}
          placeholderTextColor={theme.quiet}
          autoFocus
          autoComplete="name"
          textContentType="givenName"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => ageRef.current?.focus()}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <TextInput
          ref={ageRef}
          value={ageText}
          onChangeText={setAgeText}
          keyboardType="number-pad"
          placeholder={t('auth.ageOptional')}
          placeholderTextColor={theme.quiet}
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <TextInput
          ref={bioRef}
          value={bio}
          onChangeText={setBio}
          placeholder={t('auth.oneLinerOptional')}
          placeholderTextColor={theme.quiet}
          maxLength={MAX_BIO_LENGTH}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        <PrimaryButton
          title={t('common.continue')}
          theme={theme}
          disabled={name.trim().length < 2}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              let avatarUrl: string | undefined;
              if (photoUri) {
                avatarUrl = await uploadAvatar(photoUri);
              }
              await completeProfile(
                name.trim(),
                avatarUrl,
                bio.trim() || undefined,
                sanitizeAge(Number(ageText))
              );
              await refreshProfile();
              router.replace('/(tabs)/nearby');
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
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space[24], gap: space[12], justifyContent: 'center' },
  input: { borderRadius: radius.md, padding: space[16], minHeight: 52 },
});
