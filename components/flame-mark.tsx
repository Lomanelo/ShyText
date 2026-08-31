import { Image, StyleSheet } from 'react-native';

export function FlameMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/images/icon.png')}
      accessibilityIgnoresInvertColors
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.22 }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { resizeMode: 'cover' },
});
