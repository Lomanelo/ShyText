import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export function EmptyState({
  title,
  body,
  action,
  theme,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  theme: Theme;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>
      {action ? <PrimaryButton title={action.label} onPress={action.onPress} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
});
