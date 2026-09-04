import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TERMS_OF_SERVICE_TEXT } from '../../src/lib/legal';
import { Screen } from '../../components/Screen';
import { space, type, useTheme } from '../../theme';
import { useTranslation } from 'react-i18next';

export default function TermsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text style={[type.caption, { color: theme.muted }]}>{t('legal.englishOnly')}</Text>
        <Text selectable style={[type.body, styles.body, { color: theme.text }]}>
          {TERMS_OF_SERVICE_TEXT}
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[16], gap: space[12] },
  body: { fontSize: 15, lineHeight: 22 },
});
