import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { motion, radius, Theme } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  theme: Theme;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function PrimaryButton({ title, onPress, theme, disabled, loading, variant = 'primary' }: Props) {
  const backgroundColor =
    variant === 'ghost' ? 'transparent' : variant === 'danger' ? theme.danger : theme.accent;
  const color = variant === 'ghost' ? theme.accent : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor,
          borderColor: variant === 'ghost' ? theme.border : 'transparent',
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !disabled ? motion.press : 1 }],
        },
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.text, { color }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  text: { fontSize: 16, fontWeight: '700' },
});
