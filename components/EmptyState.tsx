import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, space, Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { EmptyArt, type EmptyArtKind } from './EmptyArt';
import { useReduceMotion } from '../hooks/useReduceMotion';

export type EmptyArt = EmptyArtKind;

/**
 * Mobbin empty pattern: optically centered column, designed motion mark,
 * short title + body, one optional CTA. No photo plates.
 */
export function EmptyState({
  title,
  body,
  action,
  theme,
  icon,
  art,
  fill = false,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  theme: Theme;
  icon?: keyof typeof Ionicons.glyphMap;
  art?: EmptyArtKind;
  /** Vertically center in the tab (Mobbin page empty). Off for inline empties under other UI. */
  fill?: boolean;
}) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const artSize = Math.round(Math.min(Math.max(screenW * 0.42, 148), 196));

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInUp.duration(motion.reveal).easing(Easing.out(Easing.cubic))}
      style={[
        styles.wrap,
        art
          ? {
              alignSelf: 'stretch',
              ...(fill
                ? {
                    minHeight: Math.max(screenH - insets.top - insets.bottom - 160, 380),
                    justifyContent: 'center' as const,
                  }
                : null),
            }
          : { maxWidth: Math.min(280, screenW - space[32] * 2), alignItems: 'flex-start' as const },
      ]}
    >
      {art ? (
        <EmptyArt kind={art} theme={theme} size={artSize} />
      ) : icon ? (
        <Ionicons name={icon} size={40} color={theme.quiet} style={styles.icon} />
      ) : null}

      <View style={[styles.copy, art ? styles.copyCentered : null]}>
        <Text style={[type.title, styles.title, { color: theme.text, textAlign: art ? 'center' : 'left' }]}>
          {title}
        </Text>
        {body ? (
          <Text style={[type.body, { color: theme.muted, textAlign: art ? 'center' : 'left' }]}>{body}</Text>
        ) : null}
        {action ? (
          <View style={[styles.action, art ? styles.actionCentered : null]}>
            <PrimaryButton title={action.label} onPress={action.onPress} theme={theme} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: space[24],
    gap: space[16],
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  copy: {
    gap: space[8],
    paddingHorizontal: space[8],
    maxWidth: 300,
    alignItems: 'flex-start',
  },
  copyCentered: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  title: {
    letterSpacing: 0.2,
  },
  icon: { marginBottom: 2 },
  action: { marginTop: space[12], alignSelf: 'flex-start', minWidth: 160 },
  actionCentered: { alignSelf: 'center' },
});
