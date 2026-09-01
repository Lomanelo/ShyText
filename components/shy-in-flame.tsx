import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { brand, motion, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from './PrimaryButton';
import { PressScale } from './PressScale';

const UNLIT = '#2A120C';
const FLICK_MIN = 40;
const FLICK_MAX = 70;
const CATCH_AT = (FLICK_MIN + FLICK_MAX) / 2;
const ARC_START = 205;
const ARC_SPAN = 130;
const TICKS = 9;

function hapticCatch() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

function hapticIgnite() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

function hapticDown() {
  void Haptics.selectionAsync();
}

function LighterWheel({
  size,
  color,
  pressed,
  flick,
  lit,
}: {
  size: number;
  color: string;
  pressed: SharedValue<number>;
  flick: SharedValue<number>;
  lit: SharedValue<number>;
}) {
  const spin = useAnimatedStyle(() => ({
    opacity:
      interpolate(pressed.value, [0, 1], [0, 1], Extrapolation.CLAMP) *
      interpolate(lit.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        rotate: `${interpolate(flick.value, [0, FLICK_MAX], [0, 52], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const diameter = size * 0.72;

  return (
    <View pointerEvents="none" style={[styles.wheelClip, { width: size * 0.8, height: size * 0.3, bottom: -6 }]}>
      <Animated.View
        style={[
          {
            width: diameter,
            height: diameter,
            position: 'absolute',
            bottom: -diameter * 0.38,
            alignSelf: 'center',
          },
          spin,
        ]}
      >
        {Array.from({ length: TICKS }, (_, index) => {
          const angle = ARC_START + (index / Math.max(1, TICKS - 1)) * ARC_SPAN;
          return (
            <View
              key={index}
              style={[
                styles.tick,
                {
                  backgroundColor: color,
                  left: diameter / 2 - 1.25,
                  top: diameter / 2 - 5.5,
                  transform: [{ rotate: `${angle}deg` }, { translateY: -diameter * 0.42 }],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
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
  size = 88,
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
  size?: number;
}) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [reader, setReader] = useState(false);
  const [ignited, setIgnited] = useState(lit);

  const pressed = useSharedValue(0);
  const flick = useSharedValue(0);
  const litSv = useSharedValue(lit ? 1 : 0);
  const grow = useSharedValue(1);
  const caught = useSharedValue(0);
  const committed = useSharedValue(lit ? 1 : 0);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (lit) {
      setIgnited(true);
      litSv.value = 1;
      committed.value = 1;
      grow.value = 1;
      return;
    }
    if (!loading) {
      setIgnited(false);
      committed.value = 0;
      caught.value = 0;
      flick.value = withSpring(0, motion.spring);
      pressed.value = withSpring(0, motion.spring);
      litSv.value = withTiming(0, { duration: motion.duration });
      grow.value = 1;
    }
  }, [lit, loading, caught, committed, flick, grow, litSv, pressed]);

  const simple = reduce || reader;
  const showLit = lit || ignited;
  const locked = disabled || loading || !onShyIn;

  const playIgnite = useCallback(() => {
    hapticIgnite();
    setIgnited(true);
    litSv.value = withTiming(1, { duration: simple ? 160 : motion.flick });
    grow.value = simple
      ? 1
      : withSequence(
          withTiming(1.14, { duration: motion.flick * 0.45 }),
          withTiming(1, { duration: motion.flick * 0.55 })
        );
    flick.value = withTiming(0, { duration: 180 });
    pressed.value = withSpring(0, motion.spring);
    void onShyIn?.();
  }, [flick, grow, litSv, onShyIn, pressed, simple]);

  const tryCommit = useCallback(
    (up: number) => {
      if (up >= FLICK_MIN) playIgnite();
      else {
        flick.value = withSpring(0, motion.spring);
        pressed.value = withSpring(0, motion.spring);
        caught.value = 0;
        committed.value = 0;
      }
    },
    [caught, committed, flick, playIgnite, pressed]
  );

  const pan = Gesture.Pan()
    .enabled(!showLit && !locked && !simple)
    .minDistance(0)
    .maxPointers(1)
    .onBegin(() => {
      if (committed.value === 1) return;
      pressed.value = withSpring(1, motion.spring);
      runOnJS(hapticDown)();
    })
    .onUpdate((event) => {
      if (committed.value === 1) return;
      const up = Math.min(FLICK_MAX, Math.max(0, -event.translationY));
      flick.value = up;
      if (up >= CATCH_AT && caught.value === 0) {
        caught.value = 1;
        runOnJS(hapticCatch)();
      }
    })
    .onEnd((event) => {
      if (committed.value === 1) return;
      const up = Math.min(FLICK_MAX, Math.max(0, -event.translationY));
      if (up >= FLICK_MIN) committed.value = 1;
      runOnJS(tryCommit)(up);
    })
    .onFinalize(() => {
      if (committed.value === 1) return;
      pressed.value = withSpring(0, motion.spring);
      flick.value = withSpring(0, motion.spring);
    });

  const tap = Gesture.Tap()
    .enabled(!showLit && !locked && simple)
    .maxDuration(8000)
    .onEnd(() => {
      if (committed.value === 1) return;
      committed.value = 1;
      runOnJS(playIgnite)();
    });

  const flameStyle = useAnimatedStyle(() => ({
    tintColor: interpolateColor(litSv.value, [0, 1], [UNLIT, brand.accent]),
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 0.92], Extrapolation.CLAMP) * grow.value,
      },
    ],
  }));

  const label = showLit ? t('venue.shydIn') : loading ? t('common.shyingIn') : t('common.shyIn');
  const a11y = showLit
    ? t('venue.shydInA11y', { name: venueName })
    : simple
      ? t('venue.tapA11y', { name: venueName })
      : t('venue.flickA11y', { name: venueName });

  const copy = (
    <View style={styles.copy}>
      <Text style={[type.title, { color: theme.text, textAlign: 'center' }]}>{label}</Text>
      <Text style={[type.body, { color: theme.muted, textAlign: 'center' }]} numberOfLines={2}>
        {venueName}
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={simple ? tap : pan}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ disabled: locked && !showLit, selected: showLit }}
          accessibilityHint={showLit ? undefined : simple ? undefined : t('nearby.flickHint')}
          style={[styles.hit, { minWidth: Math.max(44, size), minHeight: Math.max(44, size) }]}
        >
          <View style={{ width: size, height: size }} accessibilityElementsHidden>
            <Animated.Image
              source={require('../assets/images/icon.png')}
              accessibilityIgnoresInvertColors
              style={[
                styles.mark,
                { width: size, height: size, borderRadius: size * 0.22 },
                flameStyle,
              ]}
            />
            {!simple ? (
              <LighterWheel size={size} color={theme.accent} pressed={pressed} flick={flick} lit={litSv} />
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
      {showLit && onPress ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={a11y}
          onPress={onPress}
          style={styles.copyHit}
        >
          {copy}
        </PressScale>
      ) : (
        copy
      )}
      {accessory}
      {showLit && onShyOut ? (
        <PrimaryButton title={t('common.shyOut')} theme={theme} variant="ghost" onPress={onShyOut} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  hit: { alignItems: 'center', justifyContent: 'center' },
  mark: { resizeMode: 'cover' },
  copy: { alignItems: 'center', gap: 2, paddingHorizontal: 12 },
  copyHit: { minHeight: 44, justifyContent: 'center' },
  wheelClip: {
    position: 'absolute',
    alignSelf: 'center',
    overflow: 'hidden',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2.5,
    height: 11,
    borderRadius: 1,
  },
});
