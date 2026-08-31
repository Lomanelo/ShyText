import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion, radius, space, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = {
  value: string;
  onChange: (next: string) => void;
  theme: Theme;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
};

function Caret({ color, reduce }: { color: string; reduce: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.12, { duration: 480, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [opacity, reduce]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.caret, { backgroundColor: color }, style]} />;
}

function Slot({
  digit,
  active,
  theme,
  reduce,
}: {
  digit?: string;
  active: boolean;
  theme: Theme;
  reduce: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!digit || reduce) return;
    scale.value = withSequence(withSpring(1.08, motion.spring), withSpring(1, motion.spring));
  }, [digit, reduce, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          backgroundColor: theme.card,
          borderColor: active ? theme.accent : 'transparent',
        },
        style,
      ]}
    >
      <Text style={[type.title, { color: theme.text, fontVariant: ['tabular-nums'] }]}>{digit ?? ''}</Text>
      {!digit && active ? <Caret color={theme.accent} reduce={reduce} /> : null}
    </Animated.View>
  );
}

export function OtpSlots({ value, onChange, theme, onComplete, autoFocus = true }: Props) {
  const input = useRef<TextInput>(null);
  const reduce = useReduceMotion();
  const digits = value.replace(/\D/g, '').slice(0, 6).split('');

  useEffect(() => {
    if (autoFocus) {
      const id = setTimeout(() => input.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel="Verification code"
      style={{ position: 'relative' }}
    >
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <Slot key={i} digit={digits[i]} active={i === digits.length} theme={theme} reduce={reduce} />
        ))}
      </View>
      <TextInput
        ref={input}
        value={value.replace(/\D/g, '').slice(0, 6)}
        onChangeText={(raw) => {
          const next = raw.replace(/\D/g, '').slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete?.(next);
        }}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        autoFocus={autoFocus}
        maxLength={6}
        caretHidden
        style={styles.overlay}
        accessibilityLabel="6-digit code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[8] },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.02,
    color: 'transparent',
    fontSize: 1,
  },
  slot: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caret: { width: 2, height: 24, borderRadius: 1, position: 'absolute' },
});
