import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';

export default function ShyTextDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Screen theme={theme} inset={false}>
      <Text style={[type.body, { padding: 20, color: theme.muted }]}>{t('venue.noLongerVisible')}</Text>
    </Screen>
  );
}
