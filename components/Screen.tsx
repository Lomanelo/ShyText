import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme';

export function Screen({ children, theme }: { children: ReactNode; theme: Theme }) {
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
