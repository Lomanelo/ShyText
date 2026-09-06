import { Image, ImageSourcePropType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, radius, space, Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { useReduceMotion } from '../hooks/useReduceMotion';

export type EmptyArt = 'chats' | 'venues' | 'alone';

const ART: Record<EmptyArt, ImageSourcePropType> = {
  chats: require('../assets/images/empty/chats.jpg'),
  venues: require('../assets/images/empty/venues.jpg'),
  alone: require('../assets/images/empty/alone.jpg'),
};

/**
 * Mobbin-style empty state:
 * optically centered column, illustration fills content width,
 * height ~1/3 of the screen (not a tiny badge, not a scroll-eating tower).
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
  art?: EmptyArt;
  /** Vertically center in the tab (Mobbin page empty). Off for inline empties under other UI. */
  fill?: boolean;
}) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const contentW = screenW - space[16] * 2;
  const artW = Math.min(contentW, 390);
  const artH = Math.round(Math.min(Math.max(screenH * 0.34, 220), artW * 1.05, 320));

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
                    minHeight: Math.max(screenH - insets.top - insets.bottom - 160, 420),
                    justifyContent: 'center' as const,
                  }
                : null),
            }
          : { maxWidth: Math.min(280, screenW - space[32] * 2), alignItems: 'flex-start' as const },
      ]}
    >
      {art ? (
        <View style={[styles.artFrame, { width: artW, height: artH }]}>
          <Image source={ART[art]} accessibilityIgnoresInvertColors style={styles.art} />
        </View>
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
    gap: space[20],
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  artFrame: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#FCF3E8',
    alignSelf: 'center',
  },
  art: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
