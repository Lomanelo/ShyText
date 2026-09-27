import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PrimaryButton } from '../components/PrimaryButton';
import { flameSource, AnimatedFlameImage } from '../components/flame-mark';
import { motion, radius, space, Theme, type, useTheme } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { HOW_IT_WORKS_SEEN_KEY } from '../utils/walkthrough';
import { useTranslation } from 'react-i18next';

const DEMO_VENUE = 'Café Lumen';
const DEMO_PERSON = 'Maya';

/**
 * Demo loop: rest → act → hold long enough to read → reset.
 * No page auto-advance — user taps Continue.
 */
function useDemoLoop(reduce: boolean, active: boolean) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      p.value = 0;
      return;
    }
    if (reduce) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 600 }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 2400 }),
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
      ),
      -1
    );
    return () => {
      p.value = 0;
    };
  }, [p, reduce, active]);
  return p;
}

function VenuePill({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.venuePill, { backgroundColor: theme.bg }]}>
      <Ionicons name="location" size={14} color={theme.accent} />
      <Text style={[type.caption, { color: theme.text, fontWeight: '600' }]}>{DEMO_VENUE}</Text>
    </View>
  );
}

/** Beat 1 — browsing ≠ visible. */
function LookingDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = useDemoLoop(reduce, active);

  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.4, 1], [0.45, 1, 0.45], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.demo}>
      <VenuePill theme={theme} />
      <Animated.View style={[styles.emptyBlock, { borderColor: theme.border }, fade]}>
        <Ionicons name="eye-off-outline" size={28} color={theme.quiet} />
        <Text style={[type.headline, { color: theme.muted, textAlign: 'center' }]}>
          {t('walkthrough.lookingOnly')}
        </Text>
        <Text style={[type.caption, { color: theme.quiet, textAlign: 'center' }]}>
          {t('walkthrough.noOneSeesYou')}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Beat 2 — the real control: Slide to Shyne. */
function ShyneDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = useDemoLoop(reduce, active);
  const [trackW, setTrackW] = useState(0);
  const thumb = 52;
  const travel = Math.max(0, trackW - thumb - 8);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * travel }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  const litStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 0.85], [0, 1], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: 4 + p.value * travel + thumb * 0.5,
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const doneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.85, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.demo}>
      <VenuePill theme={theme} />
      <View
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: theme.bg, borderColor: theme.border }]}
      >
        <Animated.View style={[styles.trackFill, { backgroundColor: theme.accentSoft }, fillStyle]} />
        <Animated.View style={[styles.trackHint, hintStyle]}>
          <Text style={[type.caption, { color: theme.muted, fontWeight: '600' }]}>
            {t('nearby.slideHint')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.muted} />
        </Animated.View>
        <Animated.View style={[styles.trackDone, doneStyle]}>
          <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
            {t('venue.shyningHere')}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.thumb, { backgroundColor: theme.card }, thumbStyle]}>
          <AnimatedFlameImage
            source={flameSource('dim')}
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            contentFit="contain"
            style={[styles.flame, dimStyle]}
          />
          <AnimatedFlameImage
            source={flameSource('lit')}
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            contentFit="contain"
            style={[styles.flame, styles.flameOn, litStyle]}
          />
        </Animated.View>
      </View>
      <Text style={[type.caption, { color: theme.quiet, textAlign: 'center' }]}>
        {t('walkthrough.shyneIdleHint')}
      </Text>
    </View>
  );
}

/** Beat 3 — one note → accept in Chats → private thread. */
function RequestDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = useDemoLoop(reduce, active);

  const note = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.05, 0.25], [12, 0], Extrapolation.CLAMP) }],
  }));
  const actions = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 0.45, 0.7, 0.82], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const press = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(p.value, [0.5, 0.58, 0.66], [1, 0.94, 1], Extrapolation.CLAMP) },
    ],
  }));
  const open = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.78, 0.92], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.78, 0.92], [8, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.demo}>
      <View style={[styles.row, { backgroundColor: theme.bg }]}>
        <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
          <Text style={[type.headline, { color: theme.accent }]}>{DEMO_PERSON[0]}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('vibes.coffee')}</Text>
        </View>
      </View>

      <Animated.View style={[styles.note, { backgroundColor: theme.accent }, note]}>
        <Text style={[type.body, { color: theme.onAccent }]}>{t('walkthrough.demoNote')}</Text>
      </Animated.View>

      <Animated.View style={[styles.actionsRow, actions]}>
        <Animated.View style={[styles.pill, { backgroundColor: theme.accent }, press]}>
          <Text style={[type.headline, { color: theme.onAccent, fontSize: 15 }]}>
            {t('common.accept')}
          </Text>
        </Animated.View>
        <View style={[styles.pill, { backgroundColor: theme.bg }]}>
          <Text style={[type.headline, { color: theme.muted, fontSize: 15 }]}>
            {t('common.decline')}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.openRow, open]}>
        <Ionicons name="chatbubbles-outline" size={18} color={theme.accent} />
        <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
          {t('walkthrough.chatOpen')}
        </Text>
      </Animated.View>
    </View>
  );
}

type Beat = {
  titleKey: 'title0' | 'title1' | 'title2';
  bodyKey: 'body0' | 'body1' | 'body2';
  Demo: typeof LookingDemo;
};

const BEATS: Beat[] = [
  { titleKey: 'title0', bodyKey: 'body0', Demo: LookingDemo },
  { titleKey: 'title1', bodyKey: 'body1', Demo: ShyneDemo },
  { titleKey: 'title2', bodyKey: 'body2', Demo: RequestDemo },
];

export default function HowItWorksScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirstRun = first === '1';
  const [page, setPage] = useState(0);
  const last = page === BEATS.length - 1;
  const { Demo } = BEATS[page];

  useEffect(() => {
    void AsyncStorage.setItem(HOW_IT_WORKS_SEEN_KEY, '1').catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    void Haptics.selectionAsync();
    if (isFirstRun) {
      router.replace('/(tabs)/nearby');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/nearby');
  }, [isFirstRun]);

  const next = useCallback(() => {
    if (last) {
      close();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage((n) => n + 1);
  }, [last, close]);

  return (
    <Screen theme={theme} inset={false}>
      <View
        style={[
          styles.wrap,
          {
            paddingTop: insets.top + space[12],
            paddingBottom: Math.max(insets.bottom, space[16]),
          },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.dots}>
            {BEATS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? theme.accent : theme.border,
                    width: i === page ? 18 : 8,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            onPress={close}
            hitSlop={12}
            style={styles.skip}
          >
            <Text style={{ color: theme.accent, fontWeight: '600' }}>
              {isFirstRun ? t('common.skip') : t('common.close')}
            </Text>
          </Pressable>
        </View>

        <Animated.View
          key={page}
          entering={reduce ? undefined : FadeIn.duration(motion.dissolve)}
          style={[styles.stage, { backgroundColor: theme.card }]}
        >
          <Demo theme={theme} reduce={reduce} active />
        </Animated.View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t(`walkthrough.${BEATS[page].titleKey}`)}
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {t(`walkthrough.${BEATS[page].bodyKey}`)}
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title={
              last
                ? isFirstRun
                  ? t('welcome.getStarted')
                  : t('walkthrough.done')
                : t('common.continue')
            }
            theme={theme}
            onPress={next}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[24],
    minHeight: 44,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  skip: { minHeight: 44, justifyContent: 'center' },
  stage: {
    flex: 1,
    marginTop: space[12],
    marginHorizontal: space[16],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space[24],
    justifyContent: 'center',
  },
  demo: { gap: space[16] },
  venuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: space[8],
    paddingVertical: space[32],
    paddingHorizontal: space[16],
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  track: {
    height: 60,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  trackHint: {
    position: 'absolute',
    left: 64,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackDone: { position: 'absolute', left: 64, right: 16 },
  thumb: {
    position: 'absolute',
    left: 4,
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C120E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  flame: { width: 30, height: 30 },
  flameOn: { position: 'absolute' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space[12],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    alignSelf: 'flex-end',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '88%',
  },
  actionsRow: { flexDirection: 'row', gap: space[12] },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  copy: {
    paddingHorizontal: space[24],
    paddingTop: space[20],
    gap: space[8],
  },
  title: {
    ...type.title,
    fontSize: 26,
    lineHeight: 32,
  },
  body: {
    ...type.body,
    lineHeight: 24,
  },
  footer: { paddingHorizontal: space[24], paddingTop: space[16] },
});
