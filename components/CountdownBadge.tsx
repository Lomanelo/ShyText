import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { timeLeft } from '../utils/dates';
import { radius, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

export function CountdownBadge({ expiresAt, theme }: { expiresAt: number; theme: Theme }) {
  const reduce = useReduceMotion();
  const [, setTick] = useState(0);
  const remainingMs = expiresAt - Date.now();
  const urgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000;
  const pulse = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!urgent || reduce) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [urgent, reduce, pulse]);

  const glow = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.94 + pulse.value * 0.06 }],
  }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: theme.accentSoft }, glow]}>
      <Text style={[styles.text, { color: theme.accent }]}>{timeLeft(expiresAt)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
