import { ReactNode } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Theme } from '../theme';

export function Screen({ children, theme }: { children: ReactNode; theme: Theme }) {
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
