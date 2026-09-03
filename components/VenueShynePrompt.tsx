import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { radius, space, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { flameSource } from './flame-mark';

/** Venue empty prompt — Mobbin-style: glyph + short title + soft body + dock cue. */
export function VenueShynePrompt({ theme }: { theme: Theme }) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const pulse = useSharedValue(1);
  const nudge = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      pulse.value = 1;
      nudge.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    nudge.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [nudge, pulse, reduce]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: nudge.value * 3 }],
    opacity: 0.72 + nudge.value * 0.28,
  }));

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={[styles.glyph, { backgroundColor: theme.accentSoft }]}>
        <Animated.Image
          source={flameSource('dim')}
          accessibilityIgnoresInvertColors
          style={[{ width: 36, height: 36, resizeMode: 'contain' }, flameStyle]}
        />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{t('venue.shyInToSee')}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{t('venue.shyInToSeeBody')}</Text>
      <Animated.View style={[styles.hintRow, hintStyle]}>
        <Text style={[type.caption, { color: theme.accent, fontWeight: '600' }]}>
          {t('venue.shyInToSeeHint')}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.accent} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: space[32],
    paddingBottom: space[16],
    paddingHorizontal: space[8],
    gap: space[8],
  },
  glyph: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[8],
  },
  title: {
    ...type.title,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space[12],
  },
});
