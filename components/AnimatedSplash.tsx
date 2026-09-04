import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
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
const FLAME = 160;

/**
 * Cinematic launch: the static native splash (lit flame, warm paper) hands off
 * to this identical overlay, which plays one flame breath, echoes the wordmark
 * in underneath, then dissolves with a gentle push-in to reveal the app.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const scheme = useColorScheme();
  const reduce = useReduceMotion();
  const breathe = useSharedValue(1);
  const word = useSharedValue(0);
  const veil = useSharedValue(1);
  const push = useSharedValue(1);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    // Wait one drawn frame so the overlay is on screen before the native splash goes.
    const raf = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    });

    if (reduce) {
      word.value = 1;
      veil.value = withDelay(
        600,
        withTiming(0, { duration: 220 }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      return () => cancelAnimationFrame(raf);
    }

    // One breath of the flame.
    breathe.value = withSequence(
      withTiming(1.05, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) })
    );
    // The wordmark echoes in under it, title-card style.
    word.value = withDelay(
      motion.echo,
      withTiming(1, { duration: motion.reveal, easing: Easing.out(Easing.cubic) })
    );
    // Then the whole card dissolves into the app.
    push.value = withDelay(
      1280,
      withTiming(1.03, { duration: motion.dissolve, easing: Easing.out(Easing.cubic) })
    );
    veil.value = withDelay(
      1280,
      withTiming(0, { duration: motion.dissolve, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)();
      })
    );

    return () => cancelAnimationFrame(raf);
  }, [breathe, finish, push, reduce, veil, word]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    transform: [{ scale: push.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      style={[styles.fill, { backgroundColor: scheme === 'dark' ? DARK_BG : LIGHT_BG }, veilStyle]}
    >
      {/* Flame stays dead-center so the native splash swap is invisible. */}
      <Animated.View style={flameStyle}>
        <FlameMark size={FLAME} variant="lit" />
      </Animated.View>
      <Animated.View style={[styles.wordWrap, wordStyle]}>
        <Text style={[styles.word, { color: brand.accent }]}>shytext</Text>
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
    marginTop: FLAME / 2 + 18,
    alignItems: 'center',
  },
  word: { fontSize: 26, fontWeight: '700', letterSpacing: 0.4 },
});
