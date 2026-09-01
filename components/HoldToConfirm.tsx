import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion, radius, Theme, type } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  title: string;
  onConfirm: () => void;
  theme: Theme;
  disabled?: boolean;
  loading?: boolean;
  holdLabel?: string;
  loadingLabel?: string;
  variant?: 'primary' | 'ghost';
};

export function HoldToConfirm({
  title,
  onConfirm,
  theme,
  disabled,
  loading,
  holdLabel,
  loadingLabel,
  variant = 'primary',
}: Props) {
  const reduce = useReduceMotion();
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const armed = useRef(false);
  const done = useRef(false);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const ghost = variant === 'ghost';

  useEffect(() => {
    if (!loading) {
      done.current = false;
      progress.value = 0;
      scale.value = 1;
    }
  }, [loading, progress, scale]);

  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const clearTicks = () => {
    if (ticks.current) {
      clearInterval(ticks.current);
      ticks.current = null;
    }
  };

  if (reduce) {
    return (
      <PrimaryButton
        title={title}
        theme={theme}
        disabled={disabled}
        loading={loading}
        variant={ghost ? 'ghost' : 'primary'}
        onPress={onConfirm}
      />
    );
  }

  return (
    <Animated.View style={wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('a11y.holdToConfirm', { title })}
        disabled={disabled || loading}
        onPressIn={() => {
          if (disabled || loading || done.current) return;
          armed.current = true;
          void Haptics.selectionAsync();
          scale.value = withSpring(motion.press, motion.spring);
          progress.value = withTiming(1, { duration: motion.hold, easing: Easing.out(Easing.cubic) });
          let n = 0;
          ticks.current = setInterval(() => {
            n += 1;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (n >= 2) clearTicks();
          }, motion.hold / 3);
        }}
        onPressOut={() => {
          clearTicks();
          scale.value = withSpring(1, motion.spring);
          if (done.current || !armed.current) return;
          armed.current = false;
          progress.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.cubic) });
        }}
        onPress={() => undefined}
        delayLongPress={motion.hold}
        onLongPress={() => {
          if (disabled || loading || done.current) return;
          done.current = true;
          armed.current = false;
          clearTicks();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          progress.value = 1;
          scale.value = withSequence(withSpring(1.03, motion.spring), withSpring(1, motion.spring));
          onConfirm();
        }}
        style={[
          styles.btn,
          ghost
            ? {
                backgroundColor: theme.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
              }
            : { backgroundColor: theme.accent },
          { opacity: disabled ? 0.4 : 1 },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: ghost ? 'rgba(208, 89, 39, 0.28)' : 'rgba(28, 12, 6, 0.28)' },
            fill,
          ]}
        />
        <View style={styles.label}>
          <Text style={[type.headline, { color: ghost ? theme.text : theme.onAccent }]}>
            {loading ? loadingLabel ?? `${title}…` : holdLabel ?? `Hold to ${title.toLowerCase()}`}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    transformOrigin: 'left center',
  },
  label: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
});
