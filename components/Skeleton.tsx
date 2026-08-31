import { StyleSheet, View } from 'react-native';
import { Theme } from '../theme';

export function Skeleton({ theme, count = 3 }: { theme: Theme; count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.block, { backgroundColor: theme.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { height: 96, borderRadius: 16, borderCurve: 'continuous', marginBottom: 12 },
});
