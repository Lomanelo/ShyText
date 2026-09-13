import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { FlameMark } from './flame-mark';
import { radius, Theme } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

export type EmptyArtKind = 'chats' | 'venues' | 'alone';

/**
 * Designed empty illustration — soft brand disc + living flame + a quiet glyph.
 * Replaces heavy photo art with Motion + system shapes (Mobbin Messages / Cash App calm).
 */
export function EmptyArt({
  kind,
  theme,
  size = 168,
}: {
  kind: EmptyArtKind;
  theme: Theme;
  size?: number;
}) {
  const reduce = useReduceMotion();
  const breathe = useSharedValue(1);
  const drift = useSharedValue(0);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduce) {
      breathe.value = 1;
      drift.value = 0;
      pulse.value = 0.7;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    drift.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(6, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withDelay(200, withTiming(0.45, { duration: 1400, easing: Easing.inOut(Easing.quad) }))
      ),
      -1,
      false
    );
  }, [breathe, drift, pulse, reduce]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }, { translateY: drift.value * 0.35 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.18 }],
  }));

  const glyph =
    kind === 'chats' ? 'chatbubble-ellipses-outline' : kind === 'venues' ? 'location-outline' : 'phone-portrait-outline';

  return (
    <View style={[styles.stage, { width: size, height: size }]} accessibilityElementsHidden>
      <View
        style={[
          styles.disc,
          {
            backgroundColor: theme.accentSoft,
            borderColor: theme.imageOutline,
          },
        ]}
      />
      <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle]} />
      <Animated.View style={[styles.flame, flameStyle]}>
        <FlameMark size={Math.round(size * 0.42)} variant="lit" />
      </Animated.View>
      <View style={[styles.badge, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name={glyph} size={18} color={theme.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  disc: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ring: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  flame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: '18%',
    bottom: '18%',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
