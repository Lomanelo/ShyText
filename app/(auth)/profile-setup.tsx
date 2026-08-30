import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { completeProfile } from '../../services/auth';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Text style={[styles.title, { color: theme.text }]}>What should people call you?</Text>
        <Text style={[styles.body, { color: theme.muted }]}>Keep it light. This is not a dating profile.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Display name"
          placeholderTextColor={theme.quiet}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Optional one-liner"
          placeholderTextColor={theme.quiet}
          maxLength={80}
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
              await completeProfile(name.trim(), undefined, bio.trim() || undefined);
              await refreshProfile();
              router.replace('/(tabs)/nearby');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save profile.');
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
  wrap: { flex: 1, padding: 28, gap: 14, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22 },
  input: { borderRadius: 14, padding: 14, minHeight: 52 },
});
