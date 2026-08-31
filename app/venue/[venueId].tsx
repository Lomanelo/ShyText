import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { ApproachableUserCard } from '../../components/ApproachableUserCard';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { PrimaryButton } from '../../components/PrimaryButton';
import { remainingCompact } from '../../utils/dates';
import { radius, space, type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useLocation } from '../../hooks/useLocation';
import { useShyTexts } from '../../hooks/useShyTexts';
import { getVenue } from '../../services/venues';
import { takeDownMyShyTexts } from '../../services/shytexts';
import { sendChatRequest } from '../../services/chat';
import { isDevToolsEnabled } from '../../utils/config';
import { Venue } from '../../types/venue';
import { VIBE_LABELS, ShyTextPost } from '../../types/shytext';

export default function VenueScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const theme = useTheme();
  const { user, profile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const { posts, loading } = useShyTexts(venueId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [hello, setHello] = useState<ShyTextPost | null>(null);
  const [report, setReport] = useState<ShyTextPost | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (venueId) getVenue(venueId).then(setVenue);
  }, [venueId]);

  const mine = posts.find((item) => item.authorId === user?.uid);
  const others = posts.filter((item) => item.authorId !== user?.uid);

  const ensureNearby = async () => {
    if (!venue) throw new Error('Move closer to this venue.');
    if (current.checkIn?.venueId === venueId && !current.expired) return;
    const next = await refresh();
    await current.checkInHere(venue, next?.latitude, next?.longitude);
  };

  return (
    <Screen theme={theme}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} tintColor={theme.accent} />}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[type.display, { color: theme.text }]}>{venue?.name ?? 'Venue'}</Text>
        <Text style={[type.body, { color: theme.muted }]}>People who dropped a ShyText</Text>

        {mine ? (
          <View style={[styles.own, { backgroundColor: theme.accentSoft }]}>
            <Text style={{ color: theme.accent, fontWeight: '800' }}>You’re visible</Text>
            <Text style={[styles.ownIntent, { color: theme.text }]}>
              {VIBE_LABELS[mine.vibe]} · {remainingCompact(mine.expiresAt)}
            </Text>
            {mine.message ? <Text style={{ color: theme.muted }}>“{mine.message}”</Text> : null}
            <View style={styles.ownActions}>
              <PrimaryButton
                title="Take down my ShyText"
                theme={theme}
                onPress={async () => {
                  await takeDownMyShyTexts();
                  await Haptics.selectionAsync();
                }}
              />
              <PrimaryButton
                title="Change vibe"
                theme={theme}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/shytext/create',
                    params: { venueId, vibe: mine.vibe, message: mine.message ?? '' },
                  })
                }
              />
            </View>
          </View>
        ) : null}

        {notice ? <Text style={{ color: theme.accent }}>{notice}</Text> : null}

        {loading && !posts.length ? <Skeleton theme={theme} /> : null}

        {!loading && others.length === 0 ? (
          <EmptyState
            theme={theme}
            icon="people-outline"
            title="It’s quiet here"
            body="Nobody has dropped a ShyText yet. You can be the first."
            action={
              !mine
                ? { label: 'Drop a ShyText', onPress: () => router.push({ pathname: '/shytext/create', params: { venueId } }) }
                : undefined
            }
          />
        ) : (
          others.map((post) => (
            <ApproachableUserCard
              key={post.id}
              post={post}
              theme={theme}
              onBreakIce={() => {
                if (post.authorId.startsWith('seed-')) {
                  setNotice(
                    isDevToolsEnabled()
                      ? 'This is a demo person. Drop a ShyText yourself to try a real icebreaker.'
                      : 'They’re no longer visible.'
                  );
                  return;
                }
                setHello(post);
              }}
              onReport={() => setReport(post)}
            />
          ))
        )}
      </ScrollView>

      {!mine ? (
        <View style={[styles.dock, { backgroundColor: theme.bg }]}>
          <PrimaryButton
            title="Drop a ShyText"
            theme={theme}
            onPress={() => router.push({ pathname: '/shytext/create', params: { venueId } })}
          />
        </View>
      ) : null}

      <ChatRequestModal
        visible={!!hello}
        name={hello?.authorName ?? ''}
        vibe={hello?.vibe}
        message={hello?.message}
        theme={theme}
        onClose={() => setHello(null)}
        onSend={async (intro) => {
          if (!hello || !profile) throw new Error('Sign in first.');
          await ensureNearby();
          await sendChatRequest({
            shytextId: hello.id,
            shytextMessage: hello.message,
            shytextIntent: hello.vibe,
            receiverId: hello.authorId,
            venueId: hello.venueId,
            venueName: venue?.name,
            senderName: profile.displayName,
            introMessage: intro,
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setNotice('Icebreaker sent. They’ll see it in Requests.');
        }}
      />
      <ReportModal
        visible={!!report}
        onClose={() => setReport(null)}
        theme={theme}
        targetType="user"
        targetId={report?.authorId ?? ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[16], paddingBottom: 120, gap: space[12] },
  back: { minHeight: 44, justifyContent: 'center' },
  own: { borderRadius: radius.lg, padding: space[16], gap: space[8] },
  ownIntent: { ...type.title },
  ownActions: { gap: space[8] },
  dock: { paddingHorizontal: space[16], paddingBottom: space[16], paddingTop: space[8] },
});
