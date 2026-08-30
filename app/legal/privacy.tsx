import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRIVACY_POLICY_TEXT } from '../../src/lib/legal';
import { colors, spacing, typography } from '../../src/styles/theme';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.body}>{PRIVACY_POLICY_TEXT}</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.lg },
  body: { color: colors.text.primary, fontSize: typography.fontSize.md, lineHeight: 22 },
});
