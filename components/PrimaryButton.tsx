import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, Theme, type } from '../theme';
import { PressScale } from './PressScale';

type Props = {
  title: string;
  onPress: () => void;
  theme: Theme;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary';
};

export function PrimaryButton({ title, onPress, theme, disabled, loading, variant = 'primary' }: Props) {
  const backgroundColor =
    variant === 'ghost'
      ? 'transparent'
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.card
          : theme.accent;
  const color = variant === 'ghost' ? theme.accent : variant === 'secondary' ? theme.text : theme.onAccent;
  return (
    <PressScale
      accessibilityRole="button"
      onPress={() => {
        if (!disabled && !loading) void Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled || loading}
      style={{
        minHeight: 54,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
        borderColor: variant === 'ghost' ? theme.border : 'transparent',
        backgroundColor,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[type.headline, { color }]}>{title}</Text>
      )}
    </PressScale>
  );
}
