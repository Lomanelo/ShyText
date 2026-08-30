import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Theme } from '../theme';

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
      style={[styles.btn, { backgroundColor, opacity: disabled ? 0.45 : 1, borderColor: theme.border }]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.text, { color }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: { fontSize: 16, fontWeight: '700' },
});
