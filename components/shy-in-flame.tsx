import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { brand, cardShadow, radius, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTranslation } from 'react-i18next';
import { PressScale } from './PressScale';

const COMMIT_RATIO = 0.72;
const CATCH_RATIO = 0.45;
const PAD = 4;

const SIZES = {
  dock: { thumb: 52, track: 56, mark: 34 },
  card: { thumb: 52, track: 56, mark: 34 },
  inline: { thumb: 44, track: 48, mark: 28 },
} as const;

function hapticCatch() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

function hapticIgnite() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

function hapticDown() {
  void Haptics.selectionAsync();
}

export function ShyInFlame({
  venueName,
  theme,
  lit = false,
  loading = false,
  disabled = false,
  onShyIn,
  onShyOut,
  onPress,
  accessory,
  variant = 'dock',
}: {
  venueName: string;
  theme: Theme;
  lit?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onShyIn?: () => void | Promise<void>;
  onShyOut?: () => void;
  onPress?: () => void;
  accessory?: ReactNode;
  variant?: 'dock' | 'card' | 'inline';
}) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [reader, setReader] = useState(false);
  const [ignited, setIgnited] = useState(lit);
  const size = SIZES[variant];
  const thumb = size.thumb;
  const mark = size.mark;
  const trackH = size.track;
  const hideName = variant === 'inline';

  const trackW = useSharedValue(0);
  const slide = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const progress = useSharedValue(lit ? 1 : 0);
  const grow = useSharedValue(1);
  const flicker = useSharedValue(0);
  const caught = useSharedValue(0);
  const committed = useSharedValue(lit ? 1 : 0);
  const active = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => sub.remove();
  }, []);

  const simple = reduce || reader;
  const showLit = lit || ignited;
  const locked = disabled || loading || !onShyIn;

  useEffect(() => {
    if (lit) {
      setIgnited(true);
      progress.value = 1;
      committed.value = 1;
      grow.value = 1;
      flicker.value = 0;
      return;
    }
    if (!loading) {
      setIgnited(false);
      committed.value = 0;
      caught.value = 0;
      slide.value = 0;
      active.value = 0;
      progress.value = 0;
      grow.value = 1;
      flicker.value = 0;
    }
  }, [lit, loading, active, caught, committed, flicker, grow, progress, slide]);

  const onTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      trackW.value = event.nativeEvent.layout.width;
    },
    [trackW]
  );

  const playIgnite = useCallback(() => {
    hapticIgnite();
    setIgnited(true);
    progress.value = 1;
    grow.value = 1;
    flicker.value = 0;
    void onShyIn?.();
  }, [flicker, grow, onShyIn, progress]);

  const snapBack = useCallback(() => {
    slide.value = withTiming(0, { duration: 120 });
    progress.value = withTiming(0, { duration: 120 });
    active.value = 0;
    caught.value = 0;
    committed.value = 0;
  }, [active, caught, committed, progress, slide]);

  const tryCommit = useCallback(
    (offset: number, maxTravel: number) => {
      if (maxTravel <= 0) {
        snapBack();
        return;
      }
      if (offset >= maxTravel * COMMIT_RATIO) {
        committed.value = 1;
        slide.value = maxTravel;
        playIgnite();
        return;
      }
      snapBack();
    },
    [committed, playIgnite, slide, snapBack]
  );

  const pan = Gesture.Pan()
    .enabled(!showLit && !locked && !simple)
    .activeOffsetX(12)
    .failOffsetY([-16, 16])
    .maxPointers(1)
    .onBegin(() => {
      if (committed.value === 1) return;
      dragStart.value = slide.value;
      active.value = 1;
      runOnJS(hapticDown)();
    })
    .onUpdate((event) => {
      if (committed.value === 1) return;
      const maxTravel = Math.max(0, trackW.value - thumb - PAD * 2);
      const next = Math.min(maxTravel, Math.max(0, dragStart.value + event.translationX));
      slide.value = next;
      progress.value = maxTravel > 0 ? next / maxTravel : 0;
      const catchAt = maxTravel * CATCH_RATIO;
      if (next >= catchAt && caught.value === 0) {
        caught.value = 1;
        runOnJS(hapticCatch)();
      }
    })
    .onEnd(() => {
      if (committed.value === 1) return;
      const maxTravel = Math.max(0, trackW.value - thumb - PAD * 2);
      runOnJS(tryCommit)(slide.value, maxTravel);
    })
    .onFinalize(() => {
      if (committed.value === 1) return;
      active.value = 0;
    });

  const tap = Gesture.Tap()
    .enabled(!showLit && !locked && simple)
    .maxDuration(8000)
    .onEnd(() => {
      if (committed.value === 1) return;
      committed.value = 1;
      runOnJS(playIgnite)();
    });

  const fillStyle = useAnimatedStyle(() => {
    const maxTravel = Math.max(0, trackW.value - thumb - PAD * 2);
    const width = PAD + slide.value + thumb * 0.55;
    return {
      width: Math.min(trackW.value, width),
      opacity: interpolate(slide.value, [0, maxTravel * 0.25], [0, 0.22], Extrapolation.CLAMP),
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const maxTravel = Math.max(0, trackW.value - thumb - PAD * 2);
    return {
      opacity: interpolate(slide.value, [0, maxTravel * 0.35], [1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(slide.value, [0, maxTravel], [0, 12], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slide.value },
      {
        scale: (active.value ? 0.97 : 1) * grow.value,
      },
    ],
  }));

  const dimMarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55, 1], [0.38, 0.15, 0], Extrapolation.CLAMP),
  }));

  const litMarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 0.75, 1], [0, 0.45, 0.9, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.92, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const base = interpolate(progress.value, [0, 0.4, 1], [0, 0.2, 0.55], Extrapolation.CLAMP);
    const pulse = interpolate(flicker.value, [0, 1], [0, 0.18], Extrapolation.CLAMP);
    return {
      opacity: base + pulse,
      transform: [
        {
          scale: interpolate(progress.value, [0, 1], [0.7, 1.15], Extrapolation.CLAMP) + pulse * 0.08,
        },
      ],
    };
  });

  const label = showLit ? t('venue.shydIn') : loading ? t('common.shyingIn') : t('common.shyIn');
  const a11y = showLit
    ? t('venue.shydInA11y', { name: venueName })
    : simple
      ? t('venue.tapA11y', { name: venueName })
      : t('venue.slideA11y', { name: venueName });

  if (showLit) {
    return (
      <View style={styles.wrap}>
        <View
          style={[
            styles.litBar,
            variant === 'dock'
              ? [cardShadow(theme), { backgroundColor: theme.card, borderCurve: 'continuous' as const }]
              : { backgroundColor: theme.card, borderCurve: 'continuous' as const },
          ]}
        >
          <View style={styles.litMarkWrap}>
            <Animated.View style={[styles.glow, glowStyle]} />
            <Animated.Image
              source={require('../assets/images/icon.png')}
              accessibilityIgnoresInvertColors
              style={styles.litMark}
            />
          </View>
          {onPress ? (
            <PressScale accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={styles.litCopy}>
              <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                {venueName}
              </Text>
            </PressScale>
          ) : (
            <View style={styles.litCopy}>
              <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                {venueName}
              </Text>
            </View>
          )}
          <View style={styles.trailing}>
            {accessory}
            {onShyOut ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={t('common.shyOut')}
                onPress={onShyOut}
                hitSlop={8}
                style={styles.outBtn}
              >
                <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>{t('common.shyOut')}</Text>
              </PressScale>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {hideName ? null : (
        <Text style={[type.caption, { color: theme.muted, marginBottom: 6 }]} numberOfLines={1}>
          {venueName}
        </Text>
      )}
      <View
        style={[
          variant === 'dock' ? cardShadow(theme) : null,
          { borderRadius: radius.pill, borderCurve: 'continuous' as const, overflow: 'hidden' },
        ]}
      >
        <View
          onLayout={onTrackLayout}
          style={[
            styles.track,
            {
              height: trackH,
              backgroundColor: variant === 'inline' ? theme.bg : theme.bg,
              opacity: variant === 'card' ? 0.92 : 1,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.hintWrap, { left: thumb + PAD + 8 }, hintStyle]}
          >
            <Text style={[styles.hint, { color: theme.quiet, fontSize: hideName ? 14 : 15 }]} numberOfLines={1}>
              {loading ? t('common.shyingIn') : t('nearby.slideHint')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.quiet} style={{ opacity: 0.6 }} />
          </Animated.View>
          <GestureDetector gesture={simple ? tap : pan}>
            <Animated.View
              accessible
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ disabled: locked, selected: false }}
              accessibilityHint={simple ? undefined : t('nearby.slideHint')}
              style={[
                styles.thumb,
                {
                  width: thumb,
                  height: thumb,
                  backgroundColor: theme.card,
                },
                thumbStyle,
              ]}
            >
              <Animated.View
                style={[styles.glow, { width: mark + 18, height: mark + 18 }, glowStyle]}
              />
              <Animated.Image
                source={require('../assets/images/icon.png')}
                accessibilityIgnoresInvertColors
                style={[{ width: mark, height: mark, borderRadius: 10, resizeMode: 'cover' }, dimMarkStyle]}
              />
              <Animated.Image
                source={require('../assets/images/icon.png')}
                accessibilityIgnoresInvertColors
                style={[
                  { width: mark, height: mark, borderRadius: 10, resizeMode: 'cover' },
                  styles.thumbMarkOverlay,
                  litMarkStyle,
                ]}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  track: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  hintWrap: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hint: {
    flex: 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C120E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbMarkOverlay: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: brand.accent,
  },
  litBar: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  litMarkWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  litMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  litCopy: { flex: 1, minWidth: 0, gap: 1, justifyContent: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  outBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
});
