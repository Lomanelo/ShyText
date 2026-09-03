import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { NoticeBanner } from '../../components/NoticeBanner';
import { ApproachableUserCard } from '../../components/ApproachableUserCard';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { ShyInFlame } from '../../components/shy-in-flame';
import { CountdownBadge } from '../../components/CountdownBadge';
import { VenueStamp } from '../../components/VenueStamp';
import { PressScale } from '../../components/PressScale';
import { cardShadow, radius, space, type, useTheme } from '../../theme';
import { springLayout } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useCheckIns } from '../../hooks/useCheckIns';
import { useVenueContacts } from '../../hooks/useVenueContacts';
import { useLocation } from '../../hooks/useLocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVenue } from '../../services/venues';
import { respondToRequest, sendChatRequest } from '../../services/chat';
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
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
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
  const { people, loading } = useCheckIns(here ? venueId : undefined);
  const others = people.filter((item) => item.userId !== user?.uid);
  const mine =
    people.find((item) => item.userId === user?.uid) ??
    (current.checkIn?.venueId === venueId && !current.expired ? current.checkIn : null) ??
    (pendingHere ? getPendingShyne(venueId)?.checkIn ?? null : null);
  const vibe = normalizeVibe(mine?.vibe);
  // Avoid skeleton flash while the Shyne check-in / people query is still catching up.
  const showPeopleSkeleton = here && loading && others.length === 0 && !pendingHere && !mine;

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
    if (!venue || !profile || busy) return;
    setBusy(true);
    setNotice(null);
    setShyneIntent(true);
    try {
      current.beginShyne(venue, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        age: profile.age,
      });
      const coords = await refresh();
      await current.checkInHere(venue, coords?.latitude, coords?.longitude, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        age: profile.age,
      });
    } catch (err) {
      setShyneIntent(false);
      setNotice({ text: err instanceof Error ? err.message : t('errors.couldNotCheckIn'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen options={{ title: venue?.name ?? t('common.venue') }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={here && loading} onRefresh={() => undefined} tintColor={theme.accent} />
        }
      >
        {venue || heroImageUrl ? (
          <View style={[styles.hero, cardShadow(theme)]}>
            <VenueStamp category={venue?.category} height={168} imageUrl={heroImageUrl} />
          </View>
        ) : null}

        <View style={styles.content}>
          {here && mine ? (
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

          {!here ? (
            <EmptyState theme={theme} title={t('venue.shyInToSee')} />
          ) : showPeopleSkeleton ? (
            <Skeleton theme={theme} />
          ) : others.length === 0 ? (
            <EmptyState theme={theme} title={t('venue.justYou')} />
          ) : (
            others.map((person) => {
              const mode = modeFor(person.userId);
              return (
              <Animated.View key={person.id} layout={reduce ? undefined : springLayout()}>
                <ApproachableUserCard
                  person={person}
                  theme={theme}
                  mode={mode}
                  onSend={() => {
                    if (mode.kind !== 'send') return;
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
                    if (mode.kind !== 'accept') return;
                    try {
                      markAccepted(person.userId);
                      const convoId = await respondToRequest(mode.request, true);
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
                    if (mode.kind === 'chat' && mode.conversationId) {
                      router.push(`/chat/${mode.conversationId}`);
                      return;
                    }
                    router.push('/(tabs)/chats');
                  }}
                  onReport={() => setReport(person)}
                />
              </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      {venue ? (
        <View style={[styles.dock, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ShyInFlame
            variant="dock"
            venueName={venue.name}
            theme={theme}
            lit={here}
            loading={busy}
            expiresAt={here ? mine?.expiresAt : undefined}
            onShyIn={here ? undefined : checkInNow}
            onShyOut={
              here
                ? async () => {
                    await current.leave();
                    await Haptics.selectionAsync();
                  }
                : undefined
            }
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
        onSend={async (intro) => {
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
