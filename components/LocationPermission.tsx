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
      <Text style={[type.display, { color: theme.text }]}>Find where you are</Text>
      <Text style={[type.body, { color: theme.muted }]}>Used only to match you to a venue.</Text>
      {error ? (
        <Text selectable style={[type.body, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton title="Allow location" onPress={onAllow} theme={theme} loading={busy} />
      <PrimaryButton title="Open settings" onPress={() => Linking.openSettings()} theme={theme} variant="secondary" />
    </View>
  );
}
