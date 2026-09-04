import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { motion, space, Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { useReduceMotion } from '../hooks/useReduceMotion';

export function EmptyState({
  title,
  body,
  action,
  theme,
  icon,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  theme: Theme;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const reduce = useReduceMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInUp.duration(motion.reveal).easing(Easing.out(Easing.cubic))}
      style={styles.wrap}
    >
      {icon ? <Ionicons name={icon} size={28} color={theme.quiet} /> : null}
      <Text style={[type.title, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: theme.muted }]}>{body}</Text> : null}
      {action ? <PrimaryButton title={action.label} onPress={action.onPress} theme={theme} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space[24], gap: space[8], alignItems: 'flex-start' },
});
