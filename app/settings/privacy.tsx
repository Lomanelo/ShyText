import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme';

const POINTS = [
  'Your exact location is never shown to other users.',
  'Location is only used in the foreground to suggest a venue.',
  'You check in on purpose. Presence is not broadcast.',
  'Check-ins expire after 60 minutes.',
  'We never show how many silent people are at a venue.',
  'Chats stay private and do not disappear when a ShyText expires.',
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
