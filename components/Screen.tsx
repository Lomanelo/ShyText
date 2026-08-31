import { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme';

export function Screen({
  children,
  theme,
  inset = true,
}: {
  children: ReactNode;
  theme: Theme;
  inset?: boolean;
}) {
  if (!inset) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>;
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>{children}</SafeAreaView>;
}
