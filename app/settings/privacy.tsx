import { ScrollView, StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';

const POINTS = [
  'Your exact location is never shown to other users.',
  'Location is only used in the foreground to suggest a venue.',
  'Being at a venue never makes you visible. You check in on purpose.',
  'Only people checked in at the same venue appear — and only after you check in too.',
  'We never show how many silent people are nearby.',
  'Chats stay private after you leave or your check-in expires.',
  'Lock-screen notifications do not include private message text.',
];

export default function PrivacyScreen() {
  const theme = useTheme();
  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        {POINTS.map((point) => (
          <Text key={point} style={[type.body, { color: theme.muted }]}>
            {point}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14 },
});
