import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme';

const POINTS = [
  'Your exact location is never shown to other users.',
  'Location is only used in the foreground to suggest a venue.',
  'Checking in never makes you visible. You go visible on purpose.',
  'Only people with an active ShyText appear at a venue.',
  'We never show how many silent people are checked in.',
  'Chats stay private after you stop being visible or leave.',
  'Lock-screen notifications do not include private message text.',
];

export default function PrivacyScreen() {
  const theme = useTheme();
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={{ color: theme.accent, fontWeight: '700' }} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>Privacy</Text>
        {POINTS.map((point) => (
          <Text key={point} style={[styles.item, { color: theme.muted }]}>
            {point}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14 },
  title: { fontSize: 32, fontWeight: '800' },
  item: { fontSize: 16, lineHeight: 24 },
});
