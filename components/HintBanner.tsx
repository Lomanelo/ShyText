import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, Theme, type } from '../theme';
import { PressScale } from './PressScale';

export function HintBanner({
  title,
  theme,
  onDismiss,
}: {
  title: string;
  theme: Theme;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.wrap, { backgroundColor: theme.accentSoft }]}>
      <Text style={[type.headline, { color: theme.text, flex: 1 }]}>{title}</Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Dismiss hint"
        onPress={onDismiss}
        hitSlop={8}
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={theme.quiet} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingLeft: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
