import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FlameMark } from './flame-mark';
import { brand, motion } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

/** Must match the expo-splash-screen plugin config exactly for a seamless handoff. */
const LIGHT_BG = '#FCF3E8';
const DARK_BG = '#12100E';
const FLAME = 148;

/**
 * Cinematic launch: native splash (lit flame) hands off to this overlay —
 * one flame breath, ShyText wordmark rises underneath, then a soft dissolve.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const scheme = useColorScheme();
  const reduce = useReduceMotion();
  const breathe = useSharedValue(1);
  const word = useSharedValue(0);
  const veil = useSharedValue(1);
  const push = useSharedValue(1);
  const flameLift = useSharedValue(0);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    });

    if (reduce) {
      word.value = 1;
      flameLift.value = 1;
      veil.value = withDelay(
        520,
        withTiming(0, { duration: 220 }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      return () => cancelAnimationFrame(raf);
    }

    // Soft breath on the flame.
    breathe.value = withSequence(
      withTiming(1.06, { duration: 680, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 680, easing: Easing.inOut(Easing.quad) })
    );

    // Flame drifts up slightly as the wordmark claims the space below.
    flameLift.value = withDelay(
      280,
      withTiming(1, { duration: motion.reveal, easing: Easing.out(Easing.cubic) })
    );

    // Wordmark: title-card fade + rise.
    word.value = withDelay(
      motion.echo + 80,
      withTiming(1, { duration: motion.reveal, easing: Easing.out(Easing.cubic) })
    );

    // Dissolve into the app.
    push.value = withDelay(
      1480,
      withTiming(1.028, { duration: motion.dissolve, easing: Easing.out(Easing.cubic) })
    );
    veil.value = withDelay(
      1480,
      withTiming(0, { duration: motion.dissolve, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)();
      })
    );

    return () => cancelAnimationFrame(raf);
  }, [breathe, finish, flameLift, push, reduce, veil, word]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    transform: [{ scale: push.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(flameLift.value, [0, 1], [0, -18]) },
      { scale: breathe.value },
    ],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: interpolate(word.value, [0, 1], [18, 0]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      style={[styles.fill, { backgroundColor: scheme === 'dark' ? DARK_BG : LIGHT_BG }, veilStyle]}
    >
      <Animated.View style={flameStyle}>
        <FlameMark size={FLAME} variant="lit" />
      </Animated.View>
      <Animated.View style={[styles.wordWrap, wordStyle]}>
        <Text style={[styles.word, { color: brand.accent }]}>ShyText</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: FLAME / 2 + 10,
    alignItems: 'center',
  },
  word: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
