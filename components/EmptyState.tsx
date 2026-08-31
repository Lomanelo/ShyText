import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export function EmptyState({
  title,
  body,
  action,
  theme,
  icon = 'leaf-outline',
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  theme: Theme;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.wrap, { backgroundColor: theme.card }]}>
      <View style={[styles.iconWell, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={28} color={theme.accent} />
      </View>
      <Text style={[type.title, { color: theme.text }]}>{title}</Text>
      <Text style={[type.body, { color: theme.muted }]}>{body}</Text>
      {action ? <PrimaryButton title={action.label} onPress={action.onPress} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space[24], gap: space[12], borderRadius: radius.lg },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
