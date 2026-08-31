import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { ApproachableUserCard } from '../../components/ApproachableUserCard';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CountdownBadge } from '../../components/CountdownBadge';
import { VenueStamp } from '../../components/VenueStamp';
import { PressScale } from '../../components/PressScale';
import { cardShadow, radius, space, type, useTheme } from '../../theme';
import { springLayout } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useCheckIns } from '../../hooks/useCheckIns';
import { useLocation } from '../../hooks/useLocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVenue } from '../../services/venues';
import { sendChatRequest } from '../../services/chat';
import { isDevToolsEnabled, MAX_STATUS_LENGTH } from '../../utils/config';
import { CheckIn, Venue } from '../../types/venue';
import { SHYTEXT_VIBES, VIBE_LABELS, normalizeVibe } from '../../types/shytext';

export default function VenueScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const theme = useTheme();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const { people, loading } = useCheckIns(venueId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [hello, setHello] = useState<CheckIn | null>(null);
  const [report, setReport] = useState<CheckIn | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (venueId) getVenue(venueId).then(setVenue);
  }, [venueId]);

  const here = !!venueId && current.checkIn?.venueId === venueId && !current.expired;
  const others = people.filter((item) => item.userId !== user?.uid);
  const mine = people.find((item) => item.userId === user?.uid) ?? (here ? current.checkIn : null);
  const vibe = normalizeVibe(mine?.vibe);

  useEffect(() => {
    if (here && mine?.id) setStatusDraft(mine.status ?? '');
  }, [here, mine?.id]);

  useEffect(() => {
    if (!here || vibe !== 'other') return;
    const id = setTimeout(() => {
      void current.setVibe('other', statusDraft).catch((err) => {
        setStatusError(err instanceof Error ? err.message : 'Could not save that.');
      });
    }, 420);
    return () => clearTimeout(id);
  }, [here, vibe, statusDraft]);

  const checkInNow = async () => {
    if (!venue || !profile || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const coords = await refresh();
      await current.checkInHere(venue, coords?.latitude, coords?.longitude, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        age: profile.age,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not check in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen options={{ title: venue?.name ?? 'Venue' }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} tintColor={theme.accent} />}
      >
        {venue ? (
          <View style={[styles.hero, cardShadow(theme)]}>
            <VenueStamp category={venue.category} height={168} />
          </View>
        ) : null}

        <View style={styles.content}>
          {here && mine ? (
            <Animated.View
              layout={reduce ? undefined : springLayout()}
              style={[styles.own, cardShadow(theme), { backgroundColor: theme.card }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.ownIntent, { color: theme.text }]}>You’re here</Text>
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
                      {VIBE_LABELS[item]}
                    </Text>
                  </PressScale>
                ))}
              </View>
              {vibe === 'other' ? (
                <Animated.View
                  layout={reduce ? undefined : springLayout()}
                  style={[styles.statusBox, { backgroundColor: theme.bg }]}
                >
                  <TextInput
                    value={statusDraft}
                    onChangeText={(value) => {
                      setStatusError(null);
                      setStatusDraft(value);
                    }}
                    maxLength={MAX_STATUS_LENGTH}
                    placeholder="What are you up to?"
                    placeholderTextColor={theme.quiet}
                    returnKeyType="done"
                    style={[styles.statusInput, { color: theme.text }]}
                  />
                  <Text style={[type.caption, { color: theme.quiet, fontVariant: ['tabular-nums'] }]}>
                    {MAX_STATUS_LENGTH - statusDraft.length}
                  </Text>
                </Animated.View>
              ) : null}
              {statusError ? <Text style={{ color: theme.danger }}>{statusError}</Text> : null}
              <PrimaryButton
                title="Leave"
                theme={theme}
                variant="ghost"
                onPress={async () => {
                  await current.leave();
                  await Haptics.selectionAsync();
                }}
              />
            </Animated.View>
          ) : null}

          {notice ? <Text style={{ color: theme.danger }}>{notice}</Text> : null}

          {!here ? (
            <EmptyState theme={theme} title="Check in to see who’s here" />
          ) : loading && !people.length ? (
            <Skeleton theme={theme} />
          ) : others.length === 0 ? (
            <EmptyState theme={theme} title="Just you" />
          ) : (
            others.map((person) => (
              <Animated.View key={person.id} layout={reduce ? undefined : springLayout()}>
                <ApproachableUserCard
                  person={person}
                  theme={theme}
                  onSend={() => {
                    if (person.userId.startsWith('seed-')) {
                      setNotice(
                        isDevToolsEnabled()
                          ? 'This is a demo person. Check in yourself to send a real ShyText.'
                          : 'They’re no longer checked in.'
                      );
                      return;
                    }
                    setHello(person);
                  }}
                  onReport={() => setReport(person)}
                />
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      {!here ? (
        <Animated.View
          layout={reduce ? undefined : springLayout()}
          style={[styles.dock, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <PrimaryButton title="Check in" theme={theme} loading={busy} onPress={checkInNow} />
        </Animated.View>
      ) : null}

      <ChatRequestModal
        visible={!!hello}
        name={hello?.displayName ?? ''}
        vibe={hello?.vibe ? normalizeVibe(hello.vibe) : undefined}
        message={hello?.status}
        theme={theme}
        onClose={() => setHello(null)}
        onSend={async (intro) => {
          if (!hello || !profile || !venueId) throw new Error('Sign in first.');
          if (!here) throw new Error('Check in here first.');
          await sendChatRequest({
            checkInId: hello.id,
            shytextIntent: hello.vibe,
            receiverId: hello.userId,
            venueId,
            venueName: venue?.name,
            senderName: profile.displayName,
            introMessage: intro,
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setNotice('ShyText sent. They’ll see it in Requests.');
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
  scroll: { paddingBottom: 120, gap: space[12] },
  hero: {
    marginHorizontal: space[16],
    marginTop: space[8],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  content: { paddingHorizontal: space[16], gap: space[12] },
  own: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space[16], gap: space[12] },
  ownIntent: { ...type.title, flex: 1 },
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
  dock: { paddingHorizontal: space[16], paddingTop: space[8] },
});
