import { Image, ImageSourcePropType, StyleSheet } from 'react-native';

const SOURCES = {
  /** Black flame, transparent — for buttons / wordmark on light surfaces. */
  mark: require('../assets/images/flame-mark.png') as ImageSourcePropType,
  /** Brand orange flame — hero / active accents. */
  lit: require('../assets/images/flame-lit.png') as ImageSourcePropType,
  /** Gray dim flame — idle slide thumb. */
  dim: require('../assets/images/flame-dim.png') as ImageSourcePropType,
} as const;

export type FlameMarkVariant = keyof typeof SOURCES;

export function flameSource(variant: FlameMarkVariant = 'mark') {
  return SOURCES[variant];
}

export function FlameMark({
  size = 48,
  variant = 'mark',
}: {
  size?: number;
  variant?: FlameMarkVariant;
}) {
  return (
    <Image
      source={flameSource(variant)}
      accessibilityIgnoresInvertColors
      style={[styles.mark, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { resizeMode: 'contain' },
});
