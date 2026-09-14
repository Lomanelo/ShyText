import { Platform, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../theme';
import { FlameMark } from './flame-mark';

type WordmarkVariant = 'default' | 'nav';

/**
 * Brand lockup.
 * - default: auth / permission screens (accent word + black mark)
 * - nav: tab header (Mobbin: Instagram / YouTube / BeReal) — lit mark + ink word, compact
 */
export function Wordmark({
  theme,
  size = 22,
  variant = 'default',
}: {
  theme: Theme;
  size?: number;
  variant?: WordmarkVariant;
}) {
  if (variant === 'nav') {
    return (
      <View style={styles.navRow} accessibilityRole="header" accessibilityLabel="ShyText">
        <FlameMark size={22} variant="lit" />
        <Text style={[styles.navWord, { color: theme.text }]}>ShyText</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <FlameMark size={size} />
      <Text style={[styles.word, { color: theme.accent, fontSize: Math.round(size * 0.72) }]}>
        ShyText
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontWeight: '700', letterSpacing: 0.2 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // Keep lockup inside the 44pt nav content area under the notch.
    height: Platform.OS === 'ios' ? 28 : 32,
    paddingLeft: Platform.OS === 'ios' ? 4 : 0,
  },
  navWord: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    // Optical align with flame glyph (flame art has top padding).
    marginTop: Platform.OS === 'ios' ? 1 : 0,
  },
});
