import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FlameMark } from '../../components/flame-mark';
import { space, Theme, type, useTheme } from '../../theme';
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

export default function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [beat, setBeat] = useState(0);
  const beats = [t('welcome.beat1'), t('welcome.beat2'), t('welcome.beat3')];
  const last = beat >= beats.length - 1;
  const line = beats[beat];

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

        <View style={styles.hero}>
          <Animated.View
            key={`mark-${beat}`}
            entering={reduce ? undefined : ZoomIn.springify().damping(16).stiffness(240)}
          >
            <FlameMark size={96} variant="lit" />
          </Animated.View>
          <Animated.View
            key={line}
            entering={reduce ? undefined : FadeInUp.springify().damping(16).stiffness(240)}
          >
            <Text style={[styles.headline, { color: theme.text }]}>{line}</Text>
          </Animated.View>
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
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: space[32],
    paddingBottom: space[24],
  },
  headline: {
    ...type.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.4,
    maxWidth: 320,
  },
  actions: { gap: space[12], paddingBottom: space[8] },
});
