import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { NoticeBanner } from '../../components/NoticeBanner';
import { ApproachableUserCard } from '../../components/ApproachableUserCard';
import { PersonArrival } from '../../components/PersonArrival';
import { EmptyState } from '../../components/EmptyState';
import { VenueShynePrompt } from '../../components/VenueShynePrompt';
import { Skeleton } from '../../components/Skeleton';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { ShyInFlame } from '../../components/shy-in-flame';
import { CountdownBadge } from '../../components/CountdownBadge';
import { VenueStamp } from '../../components/VenueStamp';
import { PressScale } from '../../components/PressScale';
import { cardShadow, radius, space, type, useTheme } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useCheckIns } from '../../hooks/useCheckIns';
import { useVenueContacts } from '../../hooks/useVenueContacts';
import { useLocation } from '../../hooks/useLocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVenue } from '../../services/venues';
import { ensureUserProfile } from '../../services/auth';
import { ensureConversationOpen, respondToRequest, sendChatRequest } from '../../services/chat';
import { buildVenueImageUrl } from '../../services/venueImage';
import { lookupVenueImage, rememberVenueImage } from '../../services/venueImageCache';
import {
  clearPendingShyne,
  getPendingShyne,
  isPendingShyne,
  subscribePendingShyne,
  takePendingShyneError,
} from '../../services/pendingShyne';
import { isDevToolsEnabled, MAX_STATUS_LENGTH } from '../../utils/config';
import { CheckIn, Venue } from '../../types/venue';
import { SHYTEXT_VIBES, normalizeVibe } from '../../types/shytext';
import { vibeLabel } from '../../i18n/labels';
import { useTranslation } from 'react-i18next';

const SHY_OUT_MS = 260;

function resolveHeroUrl(venueId: string | undefined, seed: Venue | null): string | null {
  const cached = lookupVenueImage(venueId, seed?.id, seed?.providerPlaceId);
  if (cached) return cached;
  const built = seed ? buildVenueImageUrl(seed) : null;
  if (built) rememberVenueImage([venueId, seed?.providerPlaceId], built);
  return built;
}

export default function VenueScreen() {
  const { venueId, mode } = useLocalSearchParams<{ venueId: string; mode?: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const { modeFor, markSent, markAccepted } = useVenueContacts(user?.uid, venueId);
  // Card tap = preview. Slider / dock Shyne sets this so optimistic UI can paint.
  const [shyneIntent, setShyneIntent] = useState(mode === 'shyne');
  const pending = shyneIntent ? getPendingShyne(venueId) : null;
  const remembered =
    current.venue?.id === venueId ? current.venue : pending?.venue?.id === venueId ? pending.venue : null;
  const [venue, setVenue] = useState<Venue | null>(remembered);
  const [hello, setHello] = useState<CheckIn | null>(null);
  const [report, setReport] = useState<CheckIn | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingTick, setPendingTick] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [frozen, setFrozen] = useState<{ mine: CheckIn | null; others: CheckIn[] } | null>(null);
  // Sync cache first — React context is often still stale on the first paint after push.
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(() => resolveHeroUrl(venueId, remembered));

  useEffect(() => subscribePendingShyne(() => setPendingTick((n) => n + 1)), []);

  useEffect(() => {
    if (!venueId) return;
    const seed =
      current.venue?.id === venueId
        ? current.venue
        : shyneIntent
          ? getPendingShyne(venueId)?.venue ?? null
          : null;
    const seededUrl = resolveHeroUrl(venueId, seed);
    if (seed) setVenue((prev) => prev ?? seed);
    // Fill once if first paint missed the cache; never replace an existing URL.
    if (seededUrl) setHeroImageUrl((prev) => prev ?? seededUrl);

    let cancelled = false;
    getVenue(venueId).then((found) => {
      if (cancelled || !found) return;
      const mergedUrl = found.imageUrl ?? seed?.imageUrl;
      setVenue((prev) => ({
        ...found,
        imageUrl: prev?.imageUrl ?? mergedUrl,
      }));
      const nextUrl = buildVenueImageUrl({ ...found, imageUrl: mergedUrl });
      if (nextUrl) {
        rememberVenueImage([venueId, found.providerPlaceId], nextUrl);
        setHeroImageUrl((prev) => prev ?? nextUrl);
      }
    });
    return () => {
      cancelled = true;
    };
    // Only when navigating to a venue — ignore later check-in / remember updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const confirmedHere =
    !!venueId &&
    !!current.checkIn &&
    current.checkIn.venueId === venueId &&
    !current.expired &&
    !current.checkIn.id.startsWith('pending:');
  const pendingHere = shyneIntent && isPendingShyne(venueId);
  const here = confirmedHere || pendingHere;
  const { people, loading } = useCheckIns(here || leaving ? venueId : undefined);
  const liveOthers = people.filter((item) => item.userId !== user?.uid);
  const liveMine =
    people.find((item) => item.userId === user?.uid) ??
    (current.checkIn?.venueId === venueId && !current.expired ? current.checkIn : null) ??
    (pendingHere ? getPendingShyne(venueId)?.checkIn ?? null : null);
  const others = leaving && frozen ? frozen.others : liveOthers;
  const mine = leaving && frozen ? frozen.mine : liveMine;
  const vibe = normalizeVibe(mine?.vibe);
  const presence = useSharedValue(1);
  const prompt = useSharedValue(here || leaving ? 0 : 1);

  useLayoutEffect(() => {
    navigation.setOptions({ title: venue?.name ?? t('common.venue') });
  }, [navigation, venue?.name, t]);

  useEffect(() => {
    if (here && !leaving) {
      presence.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      prompt.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
    }
  }, [here, leaving, presence, prompt]);

  // While the live list is catching up after Shyne, don't flash "Just you" or a skeleton.
  const waitingForPeople = here && !leaving && loading && others.length === 0;
  const showPeopleSkeleton = waitingForPeople && !pendingHere && !mine;
  const showPresence = here || leaving;
  const showShynePrompt = !showPresence;

  const finishShyOut = useCallback(async () => {
    setShyneIntent(false);
    presence.value = 0;
    try {
      await current.leave();
    } finally {
      // Keep presence at 0 until the next Shyne so the roster never pops back in.
      setFrozen(null);
      setLeaving(false);
      prompt.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      await Haptics.selectionAsync();
    }
  }, [current, presence, prompt]);

  const shyOutNow = useCallback(() => {
    if (!here || leaving || busy) return;
    setFrozen({
      mine: liveMine,
      others: liveOthers,
    });
    setLeaving(true);
    setShyneIntent(false);
    if (reduce) {
      void finishShyOut();
      return;
    }
    presence.value = withTiming(0, { duration: SHY_OUT_MS, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(finishShyOut)();
    });
  }, [here, leaving, busy, liveMine, liveOthers, reduce, finishShyOut, presence]);

  const presenceStyle = useAnimatedStyle(() => ({
    opacity: presence.value,
    transform: [{ translateY: (1 - presence.value) * 8 }],
  }));
  const promptStyle = useAnimatedStyle(() => ({
    opacity: prompt.value,
    transform: [{ translateY: (1 - prompt.value) * 6 }],
  }));

  useEffect(() => {
    if (!venueId) return;
    if (confirmedHere && !current.checkIn?.id.startsWith('pending:')) clearPendingShyne(venueId);
    const failed = takePendingShyneError(venueId);
    if (failed) setNotice({ text: failed, tone: 'error' });
  }, [venueId, confirmedHere, pendingTick, current.checkIn?.id]);

  useEffect(() => {
    if (here && mine?.id) setStatusDraft(mine.status ?? '');
  }, [here, mine?.id]);

  useEffect(() => {
    if (!here || vibe !== 'other') return;
    if (mine?.id.startsWith('pending:')) return;
    const id = setTimeout(() => {
      void current.setVibe('other', statusDraft).catch((err) => {
        setStatusError(err instanceof Error ? err.message : t('errors.couldNotSave'));
      });
    }, 420);
    return () => clearTimeout(id);
  }, [here, vibe, statusDraft, mine?.id]);

  const checkInNow = async () => {
    if (!venue || busy || leaving) return;
    setBusy(true);
    setNotice(null);
    setShyneIntent(true);
    presence.value = 0;
    prompt.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) });
    try {
      const restored = await ensureUserProfile().catch(() => null);
      await refreshProfile();
      const live = restored ?? profile;
      const displayName = live?.displayName?.trim() || user?.displayName?.trim() || '';
      if (!displayName) throw new Error(t('errors.finishProfile'));
      const avatarUrl = live?.avatarUrl ?? user?.photoURL ?? undefined;
      const age = live?.age;
      current.beginShyne(venue, {
        displayName,
        avatarUrl,
        age,
      });
      const coords = await refresh();
      await current.checkInHere(venue, coords?.latitude, coords?.longitude, {
        displayName,
        avatarUrl,
        age,
      });
    } catch (err) {
      setShyneIntent(false);
      prompt.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      setNotice({ text: err instanceof Error ? err.message : t('errors.couldNotCheckIn'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {venue || heroImageUrl ? (
          <View style={[styles.hero, cardShadow(theme)]}>
            <VenueStamp category={venue?.category} height={168} imageUrl={heroImageUrl} />
          </View>
        ) : null}

        <View style={styles.content}>
          {showPresence ? (
            <Animated.View
              style={[styles.presenceBlock, presenceStyle]}
              pointerEvents={leaving ? 'none' : 'auto'}
            >
              {mine ? (
                <View style={[styles.own, cardShadow(theme), { backgroundColor: theme.card }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <CountdownBadge expiresAt={mine.expiresAt} theme={theme} />
                  </View>
                  <View style={styles.chips}>
                    {SHYTEXT_VIBES.map((item) => (
                      <PressScale
                        key={item}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          void current.setVibe(item);
                          if (item !== 'other') {
                            setStatusDraft('');
                            setStatusError(null);
                          }
                        }}
                        style={[styles.chip, { backgroundColor: item === vibe ? theme.accent : theme.bg }]}
                      >
                        <Text style={{ color: item === vibe ? theme.onAccent : theme.text, fontWeight: '700' }}>
                          {vibeLabel(item)}
                        </Text>
                      </PressScale>
                    ))}
                  </View>
                  {vibe === 'other' ? (
                    <View style={[styles.statusBox, { backgroundColor: theme.bg }]}>
                      <TextInput
                        value={statusDraft}
                        onChangeText={(value) => {
                          setStatusError(null);
                          setStatusDraft(value);
                        }}
                        maxLength={MAX_STATUS_LENGTH}
                        placeholder={t('venue.statusPlaceholder')}
                        placeholderTextColor={theme.quiet}
                        returnKeyType="done"
                        style={[styles.statusInput, { color: theme.text }]}
                      />
                      <Text style={[type.caption, { color: theme.quiet, fontVariant: ['tabular-nums'] }]}>
                        {MAX_STATUS_LENGTH - statusDraft.length}
                      </Text>
                    </View>
                  ) : null}
                  {statusError ? <Text style={{ color: theme.danger }}>{statusError}</Text> : null}
                </View>
              ) : null}

              {notice ? (
                <NoticeBanner
                  message={notice.text}
                  tone={notice.tone}
                  theme={theme}
                  onDismiss={() => setNotice(null)}
                />
              ) : null}

              {showPeopleSkeleton ? (
                <Skeleton theme={theme} />
              ) : waitingForPeople ? null : others.length === 0 ? (
                <EmptyState theme={theme} title={t('venue.justYou')} />
              ) : (
                others.map((person, index) => {
                  const contactMode = modeFor(person.userId);
                  return (
                    <PersonArrival key={person.userId} reduceMotion={reduce || leaving} staggerIndex={index}>
                      <ApproachableUserCard
                        person={person}
                        theme={theme}
                        mode={contactMode}
                        onSend={() => {
                          if (contactMode.kind !== 'send') return;
                          if (person.userId.startsWith('seed-')) {
                            setNotice({
                              text: isDevToolsEnabled()
                                ? t('venue.demoPerson')
                                : t('errors.noLongerCheckedIn'),
                              tone: 'error',
                            });
                            return;
                          }
                          setHello(person);
                        }}
                        onAccept={async () => {
                          if (contactMode.kind !== 'accept') return;
                          try {
                            markAccepted(person.userId);
                            const convoId = await respondToRequest(contactMode.request, true);
                            if (convoId) markAccepted(person.userId, convoId);
                            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            if (convoId) router.push(`/chat/${convoId}`);
                            else router.push('/(tabs)/chats');
                          } catch (err) {
                            setNotice({
                              text: err instanceof Error ? err.message : t('errors.couldNotAccept'),
                              tone: 'error',
                            });
                          }
                        }}
                        onOpenChat={() => {
                          if (contactMode.kind === 'chat' && contactMode.conversationId) {
                            const id = contactMode.conversationId;
                            void ensureConversationOpen(id)
                              .then((openId) => router.push(`/chat/${openId}`))
                              .catch(() => router.push('/(tabs)/chats'));
                            return;
                          }
                          router.push('/(tabs)/chats');
                        }}
                        onReport={() => setReport(person)}
                      />
                    </PersonArrival>
                  );
                })
              )}
            </Animated.View>
          ) : (
            <>
              {notice ? (
                <NoticeBanner
                  message={notice.text}
                  tone={notice.tone}
                  theme={theme}
                  onDismiss={() => setNotice(null)}
                />
              ) : null}
              {showShynePrompt ? (
                <Animated.View style={promptStyle}>
                  <VenueShynePrompt theme={theme} />
                </Animated.View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {venue ? (
        <View style={[styles.dock, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ShyInFlame
            variant="dock"
            venueName={venue.name}
            theme={theme}
            lit={here || leaving}
            loading={busy || leaving}
            expiresAt={here || leaving ? mine?.expiresAt : undefined}
            onShyIn={here || leaving ? undefined : checkInNow}
            onShyOut={here || leaving ? shyOutNow : undefined}
          />
        </View>
      ) : null}

      <ChatRequestModal
        visible={!!hello}
        name={hello?.displayName ?? ''}
        vibe={hello?.vibe ? normalizeVibe(hello.vibe) : undefined}
        message={hello?.status}
        theme={theme}
        onClose={() => setHello(null)}
        onSend={async (intro, introKey) => {
          if (!hello || !profile || !venueId) throw new Error(t('errors.signInFirst'));
          if (!here) throw new Error(t('errors.checkInHereFirst'));
          await sendChatRequest({
            checkInId: hello.id,
            shytextIntent: hello.vibe,
            receiverId: hello.userId,
            venueId,
            venueName: venue?.name,
            senderName: profile.displayName,
            senderAvatarUrl: profile.avatarUrl,
            introMessage: intro,
            introKey,
          });
          markSent(hello.userId);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setNotice({ text: t('venue.sent'), tone: 'ok' });
        }}
      />
      <ReportModal
        visible={!!report}
        onClose={() => setReport(null)}
        theme={theme}
        targetType="user"
        targetId={report?.userId ?? ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 112, gap: space[12] },
  hero: {
    marginHorizontal: space[16],
    marginTop: space[8],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  content: { paddingHorizontal: space[16], gap: space[12] },
  presenceBlock: { gap: space[12] },
  own: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space[16], gap: space[12] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  statusBox: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusInput: { flex: 1, fontSize: 17, minHeight: 44 },
  dock: { paddingHorizontal: space[16], paddingTop: space[4] },
});
