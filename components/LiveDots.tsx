import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';

function Dot({ color, delay, reduce }: { color: string; delay: number; reduce: boolean }) {
  const beat = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      beat.value = 1;
      return;
    }
    beat.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.28, { duration: 420, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [beat, delay, reduce]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function LiveDots({ count, color }: { count: number; color: string }) {
  const reduce = useReduceMotion();
  const dots = Math.min(4, Math.max(0, count));
  if (dots < 1) return null;
  return (
    <View style={styles.row} accessibilityElementsHidden>
      {Array.from({ length: dots }).map((_, i) => (
        <Dot key={i} color={color} delay={i * 90} reduce={reduce} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
