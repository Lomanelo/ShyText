import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { brand, cardShadow, radius, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTranslation } from 'react-i18next';
import { timeLeft } from '../utils/dates';
import { PressScale } from './PressScale';
import { flameSource } from './flame-mark';

const COMMIT_RATIO = 0.72;
const CATCH_RATIO = 0.45;
const PAD_X = 4;

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

function LitStrip({
  theme,
  venueName,
  trackH,
  mark,
  expiresAt,
  onPress,
  onShyOut,
  accessory,
  dock,
}: {
  theme: Theme;
  venueName: string;
  trackH: number;
  mark: number;
  expiresAt?: number | null;
  onPress?: () => void;
  onShyOut?: () => void;
  accessory?: ReactNode;
  dock?: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [, setTick] = useState(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduce) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1.06, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [breathe, reduce]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const remaining = expiresAt ? timeLeft(expiresAt) : null;
  const status = remaining
    ? t('venue.timeLeftLabel', { time: remaining })
    : t('venue.shydIn');
  const a11y = t('venue.shydInA11y', { name: venueName });

  const body = (
    <View
      style={[
        styles.litStrip,
        {
          height: trackH,
          backgroundColor: theme.accentSoft,
          borderCurve: 'continuous' as const,
        },
        dock ? [cardShadow(theme), { minHeight: 56, height: undefined, paddingVertical: 10 }] : null,
      ]}
    >
      <View
        style={[
          styles.litFlameWell,
          { width: trackH - 8, height: trackH - 8, backgroundColor: theme.card },
        ]}
      >
        <Animated.Image
          source={flameSource('lit')}
          accessibilityIgnoresInvertColors
          style={[{ width: mark, height: mark, resizeMode: 'contain' }, flameStyle]}
        />
      </View>
      <View style={styles.litCopy}>
        <Text
          style={[type.headline, { color: theme.text, fontVariant: ['tabular-nums'] }]}
          numberOfLines={1}
        >
          {status}
        </Text>
      </View>
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
  );

  if (onPress) {
    return (
      <PressScale accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={styles.wrap}>
        {body}
      </PressScale>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

export function ShyInFlame({
  venueName,
  theme,
  lit = false,
  loading = false,
  disabled = false,
  expiresAt,
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
  expiresAt?: number | null;
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
  const thumbTop = (trackH - thumb) / 2;
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
      const maxTravel = Math.max(0, trackW.value - thumb - PAD_X * 2);
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
      const maxTravel = Math.max(0, trackW.value - thumb - PAD_X * 2);
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
    const maxTravel = Math.max(0, trackW.value - thumb - PAD_X * 2);
    const width = PAD_X + slide.value + thumb * 0.55;
    return {
      width: Math.min(trackW.value, width),
      opacity: interpolate(slide.value, [0, maxTravel * 0.25], [0, 0.22], Extrapolation.CLAMP),
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const maxTravel = Math.max(0, trackW.value - thumb - PAD_X * 2);
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
    opacity: interpolate(progress.value, [0, 0.45, 1], [1, 0.35, 0], Extrapolation.CLAMP),
  }));

  const litMarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 0.7, 1], [0, 0.35, 0.92, 1], Extrapolation.CLAMP),
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

  const a11y = showLit
    ? t('venue.shydInA11y', { name: venueName })
    : simple
      ? t('venue.tapA11y', { name: venueName })
      : t('venue.slideA11y', { name: venueName });

  if (showLit) {
    return (
      <LitStrip
        theme={theme}
        venueName={venueName}
        trackH={trackH}
        mark={mark}
        expiresAt={expiresAt}
        onPress={onPress}
        onShyOut={onShyOut}
        accessory={accessory}
        dock={variant === 'dock'}
      />
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
              backgroundColor: theme.bg,
              opacity: variant === 'card' ? 0.92 : 1,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]}
          />
          <Animated.View pointerEvents="none" style={[styles.hintWrap, hintStyle]}>
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
                  left: PAD_X,
                  top: thumbTop,
                  backgroundColor: theme.card,
                },
                thumbStyle,
              ]}
            >
              <Animated.View
                style={[styles.glow, { width: mark + 18, height: mark + 18 }, glowStyle]}
              />
              <Animated.Image
                source={flameSource('dim')}
                accessibilityIgnoresInvertColors
                style={[{ width: mark, height: mark, resizeMode: 'contain' }, dimMarkStyle]}
              />
              <Animated.Image
                source={flameSource('lit')}
                accessibilityIgnoresInvertColors
                style={[
                  { width: mark, height: mark, resizeMode: 'contain' },
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
    left: 60,
    right: 16,
    top: 0,
    bottom: 0,
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
  litStrip: {
    width: '100%',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  litFlameWell: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  litCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  outBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
});
