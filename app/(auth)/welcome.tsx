import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FlameMark } from '../../components/flame-mark';
import { motion, space, Theme, type, useTheme } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTranslation } from 'react-i18next';

function StoryBar({ state, theme, reduce }: { state: 'done' | 'active' | 'idle'; theme: Theme; reduce: boolean }) {
  const progress = useSharedValue(state === 'done' ? 1 : 0);

  useEffect(() => {
    if (state === 'done') {
      progress.value = 1;
      return;
    }
    if (state === 'active') {
      progress.value = 0;
      progress.value = reduce ? 1 : withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = 0;
  }, [state, reduce, progress]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
      <Animated.View
        style={[styles.barFill, { backgroundColor: theme.accent, width: '100%', transformOrigin: 'left center' }, fill]}
      />
    </View>
  );
}

/** Candle-like breathing on the flame — the one ambient motion on this screen. */
function BreathingFlame({ reduce }: { reduce: boolean }) {
  const glow = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(0.86, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [glow, reduce]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View style={style}>
      <FlameMark size={84} variant="lit" />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [beat, setBeat] = useState(0);
  const beats = [
    { line: t('welcome.beat1'), echo: t('welcome.beat1Sub') },
    { line: t('welcome.beat2'), echo: t('welcome.beat2Sub') },
    { line: t('welcome.beat3'), echo: t('welcome.beat3Sub') },
  ];
  const last = beat >= beats.length - 1;
  const card = beats[beat];

  const reveal = (delay: number) =>
    reduce
      ? undefined
      : FadeInUp.delay(delay)
          .duration(motion.reveal)
          .easing(Easing.out(Easing.cubic));

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <View style={styles.bars}>
          {beats.map((_, i) => (
            <StoryBar
              key={i}
              theme={theme}
              reduce={reduce}
              state={i < beat ? 'done' : i === beat ? 'active' : 'idle'}
            />
          ))}
        </View>

        {/* Title card: statement, then a quiet echo. Lower third, like a film super. */}
        <View style={styles.stage}>
          <BreathingFlame reduce={reduce} />
          <View style={styles.card}>
            <Animated.View
              key={`line-${beat}`}
              entering={reveal(0)}
              exiting={reduce ? undefined : FadeOut.duration(240)}
            >
              <Text style={[styles.headline, { color: theme.text }]}>{card.line}</Text>
            </Animated.View>
            <Animated.View
              key={`echo-${beat}`}
              entering={reveal(motion.echo)}
              exiting={reduce ? undefined : FadeOut.duration(240)}
            >
              <Text style={[styles.echo, { color: theme.muted }]}>{card.echo}</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.actions}>
          {last ? (
            <PrimaryButton
              title={t('welcome.getStarted')}
              theme={theme}
              onPress={() => router.push('/(auth)/create-account')}
            />
          ) : (
            <PrimaryButton title={t('welcome.showMe')} theme={theme} onPress={() => setBeat((n) => n + 1)} />
          )}
          <PrimaryButton
            title={last ? t('welcome.haveAccount') : t('common.skip')}
            theme={theme}
            variant="secondary"
            onPress={() => router.push(last ? '/(auth)/sign-in' : '/(auth)/create-account')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: space[24],
    paddingTop: space[8],
    paddingBottom: space[8],
  },
  bars: { flexDirection: 'row', gap: 6 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  stage: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: space[32],
    paddingBottom: space[48],
  },
  card: { gap: space[12] },
  headline: {
    ...type.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.4,
    maxWidth: 320,
  },
  echo: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '400',
    letterSpacing: 0.1,
    maxWidth: 300,
  },
  actions: { gap: space[12], paddingBottom: space[8] },
});
