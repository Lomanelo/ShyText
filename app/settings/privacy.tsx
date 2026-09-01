import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';

const KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const;

export default function PrivacyScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        {KEYS.map((key) => (
          <Text key={key} style={[type.body, { color: theme.muted }]}>
            {t(`privacy.${key}`)}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14 },
});
