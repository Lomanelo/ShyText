import { ActivityIndicator, Pressable, Text } from 'react-native';
import { motion, radius, Theme, type } from '../theme';

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
  const color = variant === 'ghost' ? theme.accent : theme.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: variant === 'ghost' ? theme.border : 'transparent',
        backgroundColor,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed && !disabled ? motion.press : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[type.headline, { color }]}>{title}</Text>
      )}
    </Pressable>
  );
}
