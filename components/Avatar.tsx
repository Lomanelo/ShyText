import { Image, StyleSheet, Text, View } from 'react-native';
import { initials } from '../utils/validation';
import { Theme } from '../theme';

export function Avatar({
  name,
  uri,
  theme,
  size = 40,
}: {
  name?: string;
  uri?: string;
  theme: Theme;
  size?: number;
}) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentSoft }]}>
      <Text style={{ color: theme.accent, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
