import { StyleSheet, Text, View } from 'react-native';
import { timeLeft } from '../utils/dates';
import { radius, Theme, type } from '../theme';

export function CountdownBadge({ expiresAt, theme }: { expiresAt: number; theme: Theme }) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.text, { color: theme.accent }]}>{timeLeft(expiresAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  text: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
