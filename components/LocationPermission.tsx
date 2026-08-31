import { Linking, Text, View } from 'react-native';
import { Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { Wordmark } from './wordmark';

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
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Wordmark theme={theme} />
      <Text style={[type.display, { color: theme.text }]}>Find the place you’re in</Text>
      <Text style={[type.body, { color: theme.muted }]}>
        Location is only used to match you to a venue. Your exact GPS is never shown to anyone.
      </Text>
      {error ? (
        <Text selectable style={[type.body, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton title="Allow location" onPress={onAllow} theme={theme} loading={busy} />
      <PrimaryButton title="Open settings" onPress={() => Linking.openSettings()} theme={theme} variant="ghost" />
    </View>
  );
}
