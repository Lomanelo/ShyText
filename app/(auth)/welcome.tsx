import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FlameMark } from '../../components/flame-mark';
import { Wordmark } from '../../components/wordmark';
import { space, Theme, type, useTheme } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const BEATS = ['Invisible until you check in.', 'Hold a place. Send a ShyText.'] as const;

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
  const reduce = useReduceMotion();
  const [beat, setBeat] = useState(0);
  const line = BEATS[beat];

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <View style={styles.bars}>
            {BEATS.map((_, i) => (
              <StoryBar
                key={i}
                theme={theme}
                reduce={reduce}
                state={i < beat ? 'done' : i === beat ? 'active' : 'idle'}
              />
            ))}
          </View>
          <Wordmark theme={theme} size={28} />
        </View>

        <View style={styles.hero}>
          <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(16).stiffness(240)}>
            <FlameMark size={112} />
          </Animated.View>
          <Animated.View
            key={line}
            entering={reduce ? undefined : FadeInUp.springify().damping(16).stiffness(240)}
          >
            <Text style={[styles.headline, { color: theme.text }]}>{line}</Text>
          </Animated.View>
        </View>

        <View style={styles.actions}>
          {beat === 0 ? (
            <PrimaryButton title="Show me" theme={theme} onPress={() => setBeat(1)} />
          ) : (
            <PrimaryButton title="Get started" theme={theme} onPress={() => router.push('/(auth)/create-account')} />
          )}
          <PrimaryButton
            title={beat === 0 ? 'Skip' : 'I already have an account'}
            theme={theme}
            variant="secondary"
            onPress={() => router.push(beat === 0 ? '/(auth)/create-account' : '/(auth)/sign-in')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[24], paddingBottom: space[8], justifyContent: 'space-between' },
  top: { gap: space[16], paddingTop: space[8] },
  bars: { flexDirection: 'row', gap: 6 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  hero: { gap: space[24], paddingTop: space[16] },
  headline: { ...type.display, fontSize: 40, lineHeight: 46 },
  actions: { gap: space[12], paddingBottom: space[8] },
});
