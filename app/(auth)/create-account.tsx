import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { authErrorMessage, useAppleAuth, useGoogleAuth } from '../../hooks/useSocialAuth';
import { signUpWithEmail } from '../../services/auth';

export default function CreateAccountScreen() {
  const theme = useTheme();
  const google = useGoogleAuth();
  const apple = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>shytext</Text>
        <Text style={[styles.title, { color: theme.text }]}>Create account</Text>
        <Text style={[styles.body, { color: theme.muted }]}>Then pick a name. Email stays private.</Text>
        {error || google.error || apple.error ? (
          <Text style={{ color: theme.danger }}>{error || google.error || apple.error}</Text>
        ) : null}
        {apple.available ? (
          <PrimaryButton title="Continue with Apple" theme={theme} loading={apple.loading} onPress={apple.signIn} />
        ) : null}
        <PrimaryButton title="Continue with Google" theme={theme} loading={google.loading} onPress={google.signIn} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email (dev / optional)"
          placeholderTextColor={theme.quiet}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={theme.quiet}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
        />
        <PrimaryButton
          title="Create with email"
          theme={theme}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await signUpWithEmail(email.trim(), password);
              router.replace('/(auth)/profile-setup');
            } catch (err) {
              setError(authErrorMessage(err));
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
  wordmark: { fontWeight: '800' },
  title: { fontSize: 32, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22 },
  input: { borderRadius: 14, padding: 14, minHeight: 52 },
});
