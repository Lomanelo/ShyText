import { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PrimaryButton } from '../components/PrimaryButton';
import { Avatar } from '../components/Avatar';
import { flameSource } from '../components/flame-mark';
import { radius, space, Theme, type, useTheme } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { HOW_IT_WORKS_SEEN_KEY } from '../utils/walkthrough';
import { useTranslation } from 'react-i18next';

const DEMO_VENUE = 'Café Lumen';
const DEMO_PERSON = 'Maya';
const DEMO_PERSON_2 = 'Leo';

/** One shared looping timeline: rest → act → hold → reset. */
function useLoop(reduce: boolean) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 900 }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
      ),
      -1
    );
    return () => {
      p.value = 0;
    };
  }, [p, reduce]);
  return p;
}

/** Page 1 — invisible by default: being somewhere shows nothing. */
function HiddenDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);

  const ghost = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.35, 0.5], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.demoInner}>
      <View style={[styles.venueChip, { backgroundColor: theme.bg }]}>
        <Ionicons name="location" size={14} color={theme.accent} />
        <Text style={[type.caption, { color: theme.text, fontWeight: '600' }]}>{DEMO_VENUE}</Text>
      </View>
      <Animated.View style={[styles.personRow, { backgroundColor: theme.bg }, ghost]}>
        <Avatar name={t('common.you')} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{t('common.you')}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('walkthrough.notVisible')}</Text>
        </View>
        <Ionicons name="eye-off" size={18} color={theme.quiet} />
      </Animated.View>
    </View>
  );
}

/** Page 2 — the slide-to-Shyne gesture, demonstrated. */
function SlideDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);
  const [trackW, setTrackW] = useState(0);
  const thumb = 48;
  const travel = Math.max(0, trackW - thumb - 8);

  const onLayout = (event: LayoutChangeEvent) => setTrackW(event.nativeEvent.layout.width);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * travel }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.85], [1, 0], Extrapolation.CLAMP),
  }));
  const litStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 0.9], [0, 1], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: 4 + p.value * travel + thumb * 0.6,
    opacity: interpolate(p.value, [0, 0.5], [0, 0.25], Extrapolation.CLAMP),
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const doneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.92, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.demoInner}>
      {/* Venue chip */}
      <View style={[styles.venueChip, { backgroundColor: theme.bg }]}>
        <Ionicons name="location" size={14} color={theme.accent} />
        <Text style={[type.caption, { color: theme.text, fontWeight: '600' }]}>{DEMO_VENUE}</Text>
      </View>

      <View
        onLayout={onLayout}
        style={[styles.demoTrack, { backgroundColor: theme.bg, borderColor: theme.border }]}
      >
        <Animated.View style={[styles.demoFill, { backgroundColor: theme.accent }, fillStyle]} />
        <Animated.View style={[styles.demoHint, hintStyle]}>
          <Text style={[type.caption, { color: theme.muted, fontWeight: '600' }]}>
            {t('nearby.slideHint')}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={theme.muted} />
        </Animated.View>
        <Animated.View style={[styles.demoDone, doneStyle]}>
          <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
            {t('venue.shyningHere')}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.demoThumb, { backgroundColor: theme.card }, thumbStyle]}>
          <Animated.Image source={flameSource('dim')} style={[styles.demoFlame, dimStyle]} />
          <Animated.Image
            source={flameSource('lit')}
            style={[styles.demoFlame, styles.demoFlameOverlay, litStyle]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** Page 3 — once you Shyne, everyone Shyning here appears (and sees you). */
function PeopleDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);

  const row1 = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.05, 0.25], [8, 0], Extrapolation.CLAMP) }],
  }));
  const row2 = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.3, 0.5], [8, 0], Extrapolation.CLAMP) }],
  }));
  const rowYou = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.6, 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.6, 0.85], [8, 0], Extrapolation.CLAMP) }],
  }));

  const flame = (
    <Animated.Image source={flameSource('lit')} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
  );

  return (
    <View style={styles.demoInner}>
      <View style={[styles.venueChip, { backgroundColor: theme.bg }]}>
        <Ionicons name="location" size={14} color={theme.accent} />
        <Text style={[type.caption, { color: theme.text, fontWeight: '600' }]}>{DEMO_VENUE}</Text>
      </View>
      <Animated.View style={[styles.personRow, { backgroundColor: theme.bg }, row1]}>
        <Avatar name={DEMO_PERSON} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('vibes.coffee')}</Text>
        </View>
        {flame}
      </Animated.View>
      <Animated.View style={[styles.personRow, { backgroundColor: theme.bg }, row2]}>
        <Avatar name={DEMO_PERSON_2} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON_2}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{t('vibes.play')}</Text>
        </View>
        {flame}
      </Animated.View>
      <Animated.View
        style={[styles.personRow, { backgroundColor: theme.accentSoft }, rowYou]}
      >
        <Avatar name={t('common.you')} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{t('common.you')}</Text>
          <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
            {t('venue.shyningHere')}
          </Text>
        </View>
        {flame}
      </Animated.View>
    </View>
  );
}

/** Page 4 — pick one person, send one short hello. */
function SendDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);

  const noteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.1, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(p.value, [0.1, 0.4], [10, 0], Extrapolation.CLAMP) },
    ],
  }));
  const sentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.demoInner}>
      <View style={[styles.personRow, { backgroundColor: theme.bg }]}>
        <Avatar name={DEMO_PERSON} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{DEMO_PERSON}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>☕ {t('vibes.coffee')}</Text>
        </View>
      </View>
      <Animated.View style={[styles.noteBubble, { backgroundColor: theme.accentSoft }, noteStyle]}>
        <Text style={[type.body, { color: theme.text }]}>{t('walkthrough.demoNote')}</Text>
      </Animated.View>
      <Animated.View style={[styles.sentRow, sentStyle]}>
        <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
        <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
          {t('venue.alreadySent')}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Page 5 — the other person accepts (or it quietly expires). */
function AcceptDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);

  const card = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.05, 0.3], [10, 0], Extrapolation.CLAMP) }],
  }));
  const pills = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.3, 0.7, 0.85], [0, 1, 1, 0.35], Extrapolation.CLAMP),
  }));
  const acceptPress = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(p.value, [0.45, 0.55, 0.65], [1, 0.94, 1], Extrapolation.CLAMP) },
    ],
  }));
  const opened = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.78, 0.95], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.78, 0.95], [6, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.demoInner}>
      <Animated.View style={[styles.personRow, { backgroundColor: theme.bg }, card]}>
        <Avatar name={t('common.you')} theme={theme} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]}>{t('common.you')}</Text>
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
            {t('walkthrough.demoNote')}
          </Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.pillRow, pills]}>
        <Animated.View
          style={[styles.pill, { backgroundColor: theme.accent }, acceptPress]}
        >
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
      <Animated.View style={[styles.sentRow, { alignSelf: 'center' }, opened]}>
        <Ionicons name="chatbubble" size={16} color={theme.accent} />
        <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
          {t('walkthrough.chatOpen')}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Page 6 — a short chat, then meet for real. */
function ChatDemo({ theme, reduce }: { theme: Theme; reduce: boolean }) {
  const { t } = useTranslation();
  const p = useLoop(reduce);

  const b1 = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.05, 0.3], [8, 0], Extrapolation.CLAMP) }],
  }));
  const b2 = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.4, 0.65], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.4, 0.65], [8, 0], Extrapolation.CLAMP) }],
  }));
  const meet = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.demoInner, { justifyContent: 'center' }]}>
      <Animated.View style={[styles.bubble, styles.bubbleLeft, { backgroundColor: theme.bg }, b1]}>
        <Text style={[type.body, { color: theme.text }]}>{t('walkthrough.demoMsg1')}</Text>
      </Animated.View>
      <Animated.View style={[styles.bubble, styles.bubbleRight, { backgroundColor: theme.accent }, b2]}>
        <Text style={[type.body, { color: theme.onAccent }]}>{t('walkthrough.demoMsg2')}</Text>
      </Animated.View>
      <Animated.View style={[styles.meetRow, meet]}>
        <Animated.Image source={flameSource('lit')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
        <Text style={[type.caption, { color: theme.muted }]}>{t('walkthrough.offline')}</Text>
      </Animated.View>
    </View>
  );
}

export default function HowItWorksScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirstRun = first === '1';
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    void AsyncStorage.setItem(HOW_IT_WORKS_SEEN_KEY, '1').catch(() => undefined);
  }, []);

  const pages = [
    { title: t('walkthrough.title0'), body: t('walkthrough.body0'), demo: HiddenDemo },
    { title: t('walkthrough.title1'), body: t('walkthrough.body1'), demo: SlideDemo },
    { title: t('walkthrough.titlePeople'), body: t('walkthrough.bodyPeople'), demo: PeopleDemo },
    { title: t('walkthrough.title2'), body: t('walkthrough.body2'), demo: SendDemo },
    { title: t('walkthrough.titleAccept'), body: t('walkthrough.bodyAccept'), demo: AcceptDemo },
    { title: t('walkthrough.title3'), body: t('walkthrough.body3'), demo: ChatDemo },
  ];
  const last = page === pages.length - 1;

  const closeWalkthrough = () => {
    if (isFirstRun) {
      router.replace('/(tabs)/nearby');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/nearby');
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Screen theme={theme} inset={false}>
      <View style={[styles.wrap, { paddingTop: insets.top + space[8], paddingBottom: Math.max(insets.bottom, space[16]) }]}>
        <View style={styles.topRow}>
          <Text style={[type.headline, { color: theme.text }]}>{t('walkthrough.header')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            onPress={closeWalkthrough}
            hitSlop={12}
            style={styles.skip}
          >
            {isFirstRun ? (
              <Text style={{ color: theme.accent, fontWeight: '600' }}>{t('common.skip')}</Text>
            ) : (
              <Ionicons name="close" size={22} color={theme.quiet} />
            )}
          </Pressable>
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ flex: 1 }}
        >
          {pages.map((item, index) => {
            const Demo = item.demo;
            return (
              <View key={index} style={[styles.page, { width }]}>
                <View style={[styles.demoCard, { backgroundColor: theme.card }]}>
                  {/* Only mount the visible demo so loops stay in sync with the page. */}
                  {Math.abs(index - page) <= 1 ? <Demo theme={theme} reduce={reduce} /> : null}
                </View>
                <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
                <Text style={[type.body, { color: theme.muted, textAlign: 'center', maxWidth: 300 }]}>
                  {item.body}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={last ? (isFirstRun ? t('welcome.getStarted') : t('walkthrough.done')) : t('common.continue')}
            theme={theme}
            onPress={() => {
              if (last) {
                closeWalkthrough();
                return;
              }
              pager.current?.scrollTo({ x: (page + 1) * width, animated: true });
              setPage(page + 1);
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[24],
    minHeight: 44,
  },
  skip: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  page: {
    paddingHorizontal: space[24],
    paddingTop: space[16],
    alignItems: 'center',
    gap: space[12],
  },
  demoCard: {
    alignSelf: 'stretch',
    minHeight: 260,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space[24],
    justifyContent: 'center',
  },
  demoInner: { gap: space[12] },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  demoTrack: {
    height: 56,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  demoFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  demoHint: {
    position: 'absolute',
    left: 60,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  demoDone: { position: 'absolute', left: 60, right: 16 },
  demoThumb: {
    position: 'absolute',
    left: 4,
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C120E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  demoFlame: { width: 28, height: 28, resizeMode: 'contain' },
  demoFlameOverlay: { position: 'absolute' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space[12],
  },
  noteBubble: {
    alignSelf: 'flex-end',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  pillRow: { flexDirection: 'row', gap: space[12] },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  meetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: space[8],
  },
  title: {
    ...type.title,
    textAlign: 'center',
    marginTop: space[8],
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    marginVertical: space[12],
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: space[24] },
});
