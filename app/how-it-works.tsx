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
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
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

/** Play once, then hold. User taps Continue — no auto-advance. */
function usePlayOnce(reduce: boolean, active: boolean, duration = 1600, delay = 280) {
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
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [p, reduce, active, duration, delay]);
  return p;
}

function LetterMark({
  label,
  theme,
  size = 48,
  lit,
}: {
  label: string;
  theme: Theme;
  size?: number;
  lit?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: lit ? theme.accent : theme.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={[
          type.headline,
          {
            color: lit ? theme.onAccent : theme.accent,
            fontSize: size * 0.38,
            fontWeight: '700',
          },
        ]}
      >
        {label.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

function Progress({ count, index, theme }: { count: number; index: number; theme: Theme }) {
  return (
    <View style={styles.progress} accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSeg,
            { backgroundColor: i <= index ? theme.accent : theme.border },
          ]}
        />
      ))}
    </View>
  );
}

function VenuePill({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.venuePill, { backgroundColor: theme.bg }]}>
      <Ionicons name="location" size={14} color={theme.accent} />
      <Text style={[type.caption, { color: theme.text, fontWeight: '600' }]}>{DEMO_VENUE}</Text>
    </View>
  );
}

/** 1 — Looking at a place does nothing. */
function InvisibleDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 900, 200);
  const row = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [10, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.stageInner}>
      <VenuePill theme={theme} />
      <Animated.View style={[styles.personCard, { backgroundColor: theme.bg }, row]}>
        <LetterMark label={t('common.you')} theme={theme} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{t('common.you')}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('walkthrough.notVisible')}</Text>
        </View>
        <Ionicons name="eye-off" size={20} color={theme.quiet} />
      </Animated.View>
      <Text style={[type.caption, { color: theme.quiet, textAlign: 'center' }]}>
        {t('walkthrough.lookingHint')}
      </Text>
    </View>
  );
}

/** 2 — Slide to Shyne is the only way you appear. */
function ShyneDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 1800, 350);
  const [trackW, setTrackW] = useState(0);
  const thumb = 52;
  const travel = Math.max(0, trackW - thumb - 8);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * travel }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.85], [1, 0], Extrapolation.CLAMP),
  }));
  const litStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.35, 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: 4 + p.value * travel + thumb * 0.5,
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const doneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.9, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.stageInner}>
      <VenuePill theme={theme} />
      <View
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        style={[styles.slideTrack, { backgroundColor: theme.bg, borderColor: theme.border }]}
      >
        <Animated.View style={[styles.slideFill, { backgroundColor: theme.accentSoft }, fillStyle]} />
        <Animated.View style={[styles.slideHint, hintStyle]}>
          <Text style={[type.caption, { color: theme.muted, fontWeight: '600' }]}>
            {t('nearby.slideHint')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.muted} />
        </Animated.View>
        <Animated.View style={[styles.slideDone, doneStyle]}>
          <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
            {t('venue.shyningHere')}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.slideThumb, { backgroundColor: theme.card }, thumbStyle]}>
          <AnimatedFlameImage
            source={flameSource('dim')}
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            contentFit="contain"
            style={[styles.slideFlame, dimStyle]}
          />
          <AnimatedFlameImage
            source={flameSource('lit')}
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            contentFit="contain"
            style={[styles.slideFlame, styles.slideFlameOn, litStyle]}
          />
        </Animated.View>
      </View>
      <Text style={[type.caption, { color: theme.quiet, textAlign: 'center' }]}>
        {t('walkthrough.mustBeThere')}
      </Text>
    </View>
  );
}

/** 3 — ~30 min; open the app to restart. */
function TimerDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 1200, 200);
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.stageInner}>
      <Animated.View style={[styles.timerCard, { backgroundColor: theme.bg }, fade]}>
        <AnimatedFlameImage
          source={flameSource('lit')}
          cachePolicy="memory-disk"
          transition={0}
          priority="high"
          contentFit="contain"
          style={{ width: 36, height: 36 }}
        />
        <Text style={[styles.timerBig, { color: theme.accent }]}>30</Text>
        <Text style={[type.headline, { color: theme.text }]}>{t('walkthrough.timerUnit')}</Text>
        <Text style={[type.caption, { color: theme.muted, textAlign: 'center' }]}>
          {t('walkthrough.timerHint')}
        </Text>
      </Animated.View>
    </View>
  );
}

/** 4 — Mutual visibility only. */
function MutualDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 1400, 200);
  const you = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const them = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.35, 0.7], [0, 1], Extrapolation.CLAMP),
  }));
  const ghost = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.7, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.stageInner}>
      <VenuePill theme={theme} />
      <Animated.View style={[styles.personCard, { backgroundColor: theme.bg }, you]}>
        <LetterMark label={t('common.you')} theme={theme} lit />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{t('common.you')}</Text>
          <Text style={[type.caption, { color: theme.accent }]}>{t('venue.shyningHere')}</Text>
        </View>
        <AnimatedFlameImage
          source={flameSource('lit')}
          cachePolicy="memory-disk"
          transition={0}
          priority="high"
          contentFit="contain"
          style={{ width: 18, height: 18 }}
        />
      </Animated.View>
      <Animated.View style={[styles.personCard, { backgroundColor: theme.bg }, them]}>
        <LetterMark label={DEMO_PERSON} theme={theme} lit />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.accent }]}>{t('venue.shyningHere')}</Text>
        </View>
        <AnimatedFlameImage
          source={flameSource('lit')}
          cachePolicy="memory-disk"
          transition={0}
          priority="high"
          contentFit="contain"
          style={{ width: 18, height: 18 }}
        />
      </Animated.View>
      <Animated.View
        style={[styles.personCard, { backgroundColor: theme.bg, opacity: 0.45 }, ghost]}
      >
        <LetterMark label="?" theme={theme} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.muted }]}>{t('walkthrough.hiddenPerson')}</Text>
          <Text style={[type.caption, { color: theme.quiet }]}>{t('walkthrough.notShyning')}</Text>
        </View>
        <Ionicons name="eye-off" size={18} color={theme.quiet} />
      </Animated.View>
    </View>
  );
}

/** 5 — One note to one person. */
function SendDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 2000, 250);
  const person = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 0.25], [12, 0], Extrapolation.CLAMP) }],
  }));
  const note = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.4, 0.65], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.4, 0.65], [14, 0], Extrapolation.CLAMP) }],
  }));
  const waiting = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.78, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.stageInner}>
      <Animated.View style={[styles.personCard, { backgroundColor: theme.bg }, person]}>
        <LetterMark label={DEMO_PERSON} theme={theme} lit />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('vibes.coffee')}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.noteBubble, { backgroundColor: theme.accent }, note]}>
        <Text style={[type.body, { color: theme.onAccent }]}>{t('walkthrough.demoNote')}</Text>
      </Animated.View>
      <Animated.View style={[styles.waitingRow, waiting]}>
        <Ionicons name="time-outline" size={16} color={theme.accent} />
        <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
          {t('walkthrough.waitingInChats')}
        </Text>
      </Animated.View>
    </View>
  );
}

/** 6 — Accept → chat that outlives Shyne. */
function AcceptDemo({ theme, reduce, active }: { theme: Theme; reduce: boolean; active: boolean }) {
  const { t } = useTranslation();
  const p = usePlayOnce(reduce, active, 2200, 250);
  const card = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2], [0, 1], Extrapolation.CLAMP),
  }));
  const pills = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.15, 0.35, 0.55, 0.65], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const acceptPress = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(p.value, [0.38, 0.48, 0.55], [1, 0.94, 1], Extrapolation.CLAMP) },
    ],
  }));
  const chat = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.62, 0.8], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.62, 0.8], [8, 0], Extrapolation.CLAMP) }],
  }));
  const keep = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.85, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.stageInner}>
      <Animated.View style={[styles.personCard, { backgroundColor: theme.bg }, card]}>
        <LetterMark label={DEMO_PERSON} theme={theme} lit />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
            {t('walkthrough.demoNote')}
          </Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.pillRow, pills]}>
        <Animated.View style={[styles.pill, { backgroundColor: theme.accent }, acceptPress]}>
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
      <Animated.View style={[{ gap: space[8], width: '100%' }, chat]}>
        <View style={[styles.chatBubble, styles.chatLeft, { backgroundColor: theme.bg }]}>
          <Text style={[type.body, { color: theme.text }]}>{t('walkthrough.demoMsg1')}</Text>
        </View>
        <View style={[styles.chatBubble, styles.chatRight, { backgroundColor: theme.accent }]}>
          <Text style={[type.body, { color: theme.onAccent }]}>{t('walkthrough.demoMsg2')}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.keepRow, keep]}>
        <Ionicons name="chatbubbles-outline" size={16} color={theme.muted} />
        <Text style={[type.caption, { color: theme.muted, fontWeight: '600' }]}>
          {t('walkthrough.chatKeepsGoing')}
        </Text>
      </Animated.View>
    </View>
  );
}

type BeatKey = '0' | '1' | '2' | '3' | '4' | '5';
type Beat = {
  titleKey: `title${BeatKey}`;
  bodyKey: `body${BeatKey}`;
  Demo: typeof InvisibleDemo;
};

const BEATS: Beat[] = [
  { titleKey: 'title0', bodyKey: 'body0', Demo: InvisibleDemo },
  { titleKey: 'title1', bodyKey: 'body1', Demo: ShyneDemo },
  { titleKey: 'title2', bodyKey: 'body2', Demo: TimerDemo },
  { titleKey: 'title3', bodyKey: 'body3', Demo: MutualDemo },
  { titleKey: 'title4', bodyKey: 'body4', Demo: SendDemo },
  { titleKey: 'title5', bodyKey: 'body5', Demo: AcceptDemo },
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
  const enter = useSharedValue(1);

  useEffect(() => {
    void AsyncStorage.setItem(HOW_IT_WORKS_SEEN_KEY, '1').catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withSpring(1, motion.spring);
  }, [page, reduce, enter]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [10, 0]) }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.4, 1], [0, 1]),
    transform: [{ translateY: interpolate(enter.value, [0.4, 1], [8, 0]) }],
  }));

  const closeWalkthrough = useCallback(() => {
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

  const goNext = useCallback(() => {
    if (last) {
      closeWalkthrough();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage((n) => n + 1);
  }, [last, closeWalkthrough]);

  const { Demo } = BEATS[page];

  return (
    <Screen theme={theme} inset={false}>
      <View
        style={[
          styles.wrap,
          {
            paddingTop: insets.top + space[8],
            paddingBottom: Math.max(insets.bottom, space[16]),
          },
        ]}
      >
        <View style={styles.top}>
          <Progress count={BEATS.length} index={page} theme={theme} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            onPress={closeWalkthrough}
            hitSlop={12}
            style={styles.skip}
          >
            <Text style={{ color: theme.accent, fontWeight: '600' }}>
              {isFirstRun ? t('common.skip') : t('common.close')}
            </Text>
          </Pressable>
        </View>

        <Animated.View
          key={`stage-${page}`}
          entering={reduce ? undefined : FadeIn.duration(280)}
          exiting={reduce ? undefined : FadeOut.duration(140)}
          style={[styles.stage, { backgroundColor: theme.card }]}
        >
          <Demo theme={theme} reduce={reduce} active />
        </Animated.View>

        <View style={styles.copy}>
          <Animated.Text style={[styles.title, { color: theme.text }, titleStyle]}>
            {t(`walkthrough.${BEATS[page].titleKey}`)}
          </Animated.Text>
          <Animated.Text style={[styles.body, { color: theme.muted }, bodyStyle]}>
            {t(`walkthrough.${BEATS[page].bodyKey}`)}
          </Animated.Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={
              last
                ? isFirstRun
                  ? t('welcome.getStarted')
                  : t('walkthrough.done')
                : t('common.continue')
            }
            theme={theme}
            onPress={goNext}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space[12] },
  top: {
    paddingHorizontal: space[24],
    gap: space[12],
  },
  progress: { flexDirection: 'row', gap: 6 },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  skip: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    marginHorizontal: space[16],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space[24],
    minHeight: 260,
    justifyContent: 'center',
  },
  stageInner: { gap: space[12], justifyContent: 'center' },
  venuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space[12],
  },
  timerCard: {
    alignItems: 'center',
    gap: space[8],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: space[32],
    paddingHorizontal: space[24],
  },
  timerBig: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  slideTrack: {
    height: 60,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slideFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  slideHint: {
    position: 'absolute',
    left: 64,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slideDone: { position: 'absolute', left: 64, right: 16 },
  slideThumb: {
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
  slideFlame: { width: 30, height: 30 },
  slideFlameOn: { position: 'absolute' },
  noteBubble: {
    alignSelf: 'flex-end',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '88%',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  pillRow: { flexDirection: 'row', gap: space[12] },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubble: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '82%',
  },
  chatLeft: { alignSelf: 'flex-start' },
  chatRight: { alignSelf: 'flex-end' },
  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  copy: {
    paddingHorizontal: space[24],
    gap: space[8],
    minHeight: 120,
  },
  title: {
    ...type.title,
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    ...type.body,
    lineHeight: 24,
  },
  actions: { paddingHorizontal: space[24] },
});
