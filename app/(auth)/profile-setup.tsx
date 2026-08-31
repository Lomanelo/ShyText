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

export default function ProfileSetupScreen() {
  const theme = useTheme();
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
      setError('Photo access is needed to add a picture.');
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
        <Text style={[type.display, { color: theme.text }]}>What should people call you?</Text>
        <Pressable onPress={pickPhoto} style={{ alignSelf: 'center' }} accessibilityLabel="Add profile photo">
          <Avatar name={name} uri={photoUri} theme={theme} size={88} />
          <Text style={{ color: theme.accent, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
            Add photo
          </Text>
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="First name"
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
          placeholder="Age (optional)"
          placeholderTextColor={theme.quiet}
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <TextInput
          ref={bioRef}
          value={bio}
          onChangeText={setBio}
          placeholder="Optional one-liner"
          placeholderTextColor={theme.quiet}
          maxLength={80}
          returnKeyType="done"
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        <PrimaryButton
          title="Continue"
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
                  ? 'Could not upload that photo. Try another image, or continue without one.'
                  : message.includes('permission') || message.includes('insufficient')
                    ? 'Could not save your profile yet. Sign out and try again in a moment.'
                    : message || 'Could not save profile.'
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
