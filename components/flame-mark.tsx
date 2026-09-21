import { Image as ExpoImage } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

const SOURCES = {
  /** Black flame, transparent — for buttons / wordmark on light surfaces. */
  mark: require('../assets/images/flame-mark.png'),
  /** Brand orange flame — hero / active accents / slider lit. */
  lit: require('../assets/images/flame-lit.png'),
  /** Gray dim flame — idle slide thumb. */
  dim: require('../assets/images/flame-dim.png'),
  /** White flame — dark surfaces. */
  white: require('../assets/images/flame-white.png'),
} as const;

export type FlameMarkVariant = keyof typeof SOURCES;

export function flameSource(variant: FlameMarkVariant = 'mark') {
  return SOURCES[variant];
}

/** Static flame (nav wordmark, empty states, welcome). */
export function FlameMark({
  size = 48,
  variant = 'mark',
}: {
  size?: number;
  variant?: FlameMarkVariant;
}) {
  return (
    <ExpoImage
      source={flameSource(variant)}
      accessibilityIgnoresInvertColors
      cachePolicy="memory-disk"
      transition={0}
      priority="high"
      contentFit="contain"
      style={[styles.mark, { width: size, height: size }]}
    />
  );
}

/**
 * Reanimated-friendly flame — shares the expo-image cache warmed at splash.
 * Prefer this over Animated.Image so slider/demo marks paint instantly.
 */
export const AnimatedFlameImage = Animated.createAnimatedComponent(ExpoImage);

const styles = StyleSheet.create({
  mark: {},
});
