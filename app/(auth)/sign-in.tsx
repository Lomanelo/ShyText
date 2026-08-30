import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { authErrorMessage, useAppleAuth, useGoogleAuth } from '../../hooks/useSocialAuth';
import { getUserProfile, signInWithEmail } from '../../services/auth';
import { isDevToolsEnabled } from '../../utils/config';

export default function SignInScreen() {
  const theme = useTheme();
  const google = useGoogleAuth();
  const apple = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async () => {
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmail(email.trim(), password);
      const profile = await getUserProfile(cred.user.uid);
      router.replace(profile?.displayName ? '/(tabs)/nearby' : '/(auth)/profile-setup');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>shytext</Text>
        <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
        <Text style={[styles.body, { color: theme.muted }]}>Sign in to leave a ShyText or say hello.</Text>
        {error || google.error || apple.error ? (
          <Text style={{ color: theme.danger }}>{error || google.error || apple.error}</Text>
        ) : null}
        {apple.available ? (
          <PrimaryButton title="Sign in with Apple" theme={theme} loading={apple.loading} onPress={apple.signIn} />
        ) : null}
        <PrimaryButton title="Sign in with Google" theme={theme} loading={google.loading} onPress={google.signIn} />
        {isDevToolsEnabled() ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.quiet, fontWeight: '700' }}>DEV email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
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
            <PrimaryButton title="Sign in with email" theme={theme} loading={busy} onPress={submitEmail} />
          </View>
        ) : null}
        <Pressable onPress={() => router.push('/(auth)/create-account')}>
          <Text style={[styles.link, { color: theme.accent }]}>Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 28, gap: 14, justifyContent: 'center' },
  wordmark: { fontWeight: '800' },
  title: { fontSize: 32, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  input: { borderRadius: 14, padding: 14, minHeight: 52 },
  link: { textAlign: 'center', fontWeight: '700', marginTop: 8 },
});
