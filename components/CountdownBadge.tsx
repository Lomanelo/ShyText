import { StyleSheet, Text, View } from 'react-native';
import { timeLeft } from '../utils/dates';
import { Theme } from '../theme';

export function CountdownBadge({ expiresAt, theme }: { expiresAt: number; theme: Theme }) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.text, { color: theme.accent }]}>{timeLeft(expiresAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
