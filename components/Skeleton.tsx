import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius, Theme } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

export function Skeleton({ theme, count = 3 }: { theme: Theme; count?: number }) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduce]);

  const style = useAnimatedStyle(() => ({ opacity: reduce ? 0.45 : pulse.value }));

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View
          key={index}
          style={[styles.block, { backgroundColor: theme.border }, style, { marginBottom: 12 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { height: 208, borderRadius: radius.lg, borderCurve: 'continuous' },
});
