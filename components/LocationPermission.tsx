import { Linking, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export function LocationPermission({
  theme,
  error,
  onAllow,
  busy,
}: {
  theme: Theme;
  error?: string | null;
  onAllow: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, { color: theme.accent }]}>shytext</Text>
      <Text style={[styles.title, { color: theme.text }]}>Find your room</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        ShyText uses your location only to identify the place you're currently visiting. Your exact location is never shown to other users.
      </Text>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PrimaryButton title="Allow location" onPress={onAllow} theme={theme} loading={busy} />
      <PrimaryButton title="Open settings" onPress={() => Linking.openSettings()} theme={theme} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  kicker: { fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 34, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 24 },
});
