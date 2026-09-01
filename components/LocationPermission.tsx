import { Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Wordmark theme={theme} />
      <Text style={[type.display, { color: theme.text }]}>{t('location.title')}</Text>
      <Text style={[type.body, { color: theme.muted }]}>{t('location.body')}</Text>
      {error ? (
        <Text selectable style={[type.body, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton title={t('location.allow')} onPress={onAllow} theme={theme} loading={busy} />
      <PrimaryButton title={t('location.openSettings')} onPress={() => Linking.openSettings()} theme={theme} variant="secondary" />
    </View>
  );
}
