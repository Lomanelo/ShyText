import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../theme';
import { FlameMark } from './flame-mark';

export function Wordmark({ theme, size = 22 }: { theme: Theme; size?: number }) {
  return (
    <View style={styles.row}>
      <FlameMark size={size} />
      <Text style={[styles.word, { color: theme.accent, fontSize: Math.round(size * 0.72) }]}>ShyText</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontWeight: '700', letterSpacing: 0.2 },
});
