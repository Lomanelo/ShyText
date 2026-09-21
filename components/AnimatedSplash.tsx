import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { brand } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { warmLocalAssets } from '../services/warmAssets';

/**
 * Must match expo-splash-screen plugin `imageWidth` + backgroundColor exactly.
 * Any mismatch → visible pop on the native → JS handoff.
 */
const LIGHT_BG = '#FCF3E8';
const DARK_BG = '#12100E';
const FLAME_SIZE = 160;
const FLAME_SRC = require('../assets/images/flame-lit.png');

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_INOUT = Easing.bezier(0.45, 0, 0.55, 1);

// Start decoding stamps + flames immediately (shared promise).
void warmLocalAssets();

/**
 * Launch handoff — Cash App / Linear pattern:
 * 1) Hold a frame identical to the native splash
 * 2) One soft breath + wordmark rise
 * 3) Opacity-only dissolve (never scale the full-screen veil)
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const scheme = useColorScheme();
  const reduce = useReduceMotion();
  const [ready, setReady] = useState(false);

  const veil = useSharedValue(1);
  const breath = useSharedValue(1);
  const wordEnter = useSharedValue(0);
  const content = useSharedValue(1);

  const finish = useCallback(() => onDone(), [onDone]);

  const onFlameReady = useCallback(() => {
    setReady(true);
  }, []);

  // Warm local graphics while the splash holds; also cover load-end misses.
  useEffect(() => {
    let cancelled = false;
    void warmLocalAssets().then(() => {
      if (!cancelled) setReady(true);
    });
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Hide native splash only after the JS flame is painted — kills the flash/pop.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        void SplashScreen.hideAsync().catch(() => undefined);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    if (reduce) {
      wordEnter.value = 1;
      veil.value = withDelay(
        280,
        withTiming(0, { duration: 240, easing: EASE_OUT }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      return () => cancelAnimation(veil);
    }

    // Soft single breath — organic, not a bounce loop.
    breath.value = withDelay(
      120,
      withSequence(
        withTiming(1.045, { duration: 720, easing: EASE_INOUT }),
        withTiming(1, { duration: 640, easing: EASE_INOUT })
      )
    );

    // Wordmark title-card: fade + short rise under the flame.
    wordEnter.value = withDelay(
      420,
      withTiming(1, { duration: 640, easing: EASE_OUT })
    );

    // Dissolve: brand content first, then the solid veil — no container scale.
    content.value = withDelay(
      1320,
      withTiming(0, { duration: 420, easing: EASE_OUT })
    );
    veil.value = withDelay(
      1500,
      withTiming(0, { duration: 480, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(finish)();
      })
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(wordEnter);
      cancelAnimation(content);
      cancelAnimation(veil);
    };
  }, [breath, content, finish, ready, reduce, veil, wordEnter]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
  }));

  const flameStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ scale: breath.value }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordEnter.value * content.value,
    transform: [{ translateY: interpolate(wordEnter.value, [0, 1], [10, 0]) }],
  }));

  const bg = scheme === 'dark' ? DARK_BG : LIGHT_BG;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      style={[styles.fill, { backgroundColor: bg }, veilStyle]}
    >
      <View style={styles.stage} collapsable={false}>
        <Animated.View style={flameStyle} collapsable={false}>
          <ExpoImage
            source={FLAME_SRC}
            accessibilityIgnoresInvertColors
            onLoad={onFlameReady}
            onError={onFlameReady}
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            contentFit="contain"
            style={styles.flame}
          />
        </Animated.View>
        <Animated.View style={[styles.wordWrap, wordStyle]}>
          <Text style={[styles.word, { color: brand.accent }]}>ShyText</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    width: FLAME_SIZE,
    height: FLAME_SIZE,
  },
  wordWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  word: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
