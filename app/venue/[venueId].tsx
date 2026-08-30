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
import { CountdownBadge } from '../../components/CountdownBadge';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useShyTexts } from '../../hooks/useShyTexts';
import { getVenue } from '../../services/venues';
import { stopVisibility } from '../../services/shytexts';
import { sendChatRequest } from '../../services/chat';
import { Venue } from '../../types/venue';
import { INTENT_LABELS, ShyTextPost } from '../../types/shytext';

export default function VenueScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const theme = useTheme();
  const { user, profile } = useAuth();
  const current = useCurrentVenue();
  const { posts, loading } = useShyTexts(venueId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [hello, setHello] = useState<ShyTextPost | null>(null);
  const [report, setReport] = useState<ShyTextPost | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (venueId) getVenue(venueId).then(setVenue);
  }, [venueId]);

  const checkedIn = current.checkIn?.venueId === venueId && !current.expired;
  const mine = posts.find((item) => item.authorId === user?.uid);
  const others = posts.filter((item) => item.authorId !== user?.uid);

  return (
    <Screen theme={theme}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} />}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{venue?.name ?? 'Venue'}</Text>
        <Text style={{ color: theme.muted }}>People open right now</Text>
        {!checkedIn ? (
          <Text style={{ color: theme.danger }}>Check in on Nearby to go visible or say hi.</Text>
        ) : null}

        {mine ? (
          <View style={[styles.own, { backgroundColor: theme.accentSoft }]}>
            <Text style={{ color: theme.accent, fontWeight: '800' }}>You’re visible</Text>
            <Text style={[styles.ownIntent, { color: theme.text }]}>{INTENT_LABELS[mine.intent]}</Text>
            {mine.message ? <Text style={{ color: theme.muted }}>“{mine.message}”</Text> : null}
            <CountdownBadge expiresAt={mine.expiresAt} theme={theme} />
            <View style={styles.ownActions}>
              <PrimaryButton
                title="Edit"
                theme={theme}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/shytext/create',
                    params: { venueId, intent: mine.intent, message: mine.message ?? '' },
                  })
                }
              />
              <PrimaryButton
                title="Stop being visible"
                theme={theme}
                variant="ghost"
                onPress={async () => {
                  await stopVisibility(mine.id);
                  await Haptics.selectionAsync();
                }}
              />
            </View>
          </View>
        ) : null}

        {notice ? <Text style={{ color: theme.accent }}>{notice}</Text> : null}

        {loading && !posts.length ? <Skeleton theme={theme} /> : null}

        {!loading && others.length === 0 ? (
          <EmptyState
            theme={theme}
            title="It’s quiet here 👀"
            body="Nobody has gone visible yet."
            action={
              checkedIn && !mine
                ? { label: 'Be the first', onPress: () => router.push({ pathname: '/shytext/create', params: { venueId } }) }
                : undefined
            }
          />
        ) : (
          others.map((post) => (
            <ApproachableUserCard
              key={post.id}
              post={post}
              theme={theme}
              onSayHi={() => {
                if (post.authorId.startsWith('seed-')) {
                  setNotice('This is a demo person. Go visible yourself to try a real hi.');
                  return;
                }
                if (!checkedIn) {
                  setNotice('Check in first to say hi.');
                  return;
                }
                setHello(post);
              }}
              onReport={() => setReport(post)}
            />
          ))
        )}
      </ScrollView>

      {checkedIn && !mine ? (
        <Pressable
          accessibilityLabel="Go visible"
          onPress={() => router.push({ pathname: '/shytext/create', params: { venueId } })}
          style={[styles.fab, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.fabPlus}>+</Text>
          <Text style={styles.fabText}>Go visible</Text>
        </Pressable>
      ) : null}

      <ChatRequestModal
        visible={!!hello}
        name={hello?.authorName ?? ''}
        intentLabel={hello ? INTENT_LABELS[hello.intent] : undefined}
        message={hello?.message}
        theme={theme}
        onClose={() => setHello(null)}
        onSend={async (intro) => {
          if (!hello || !profile) throw new Error('Sign in first.');
          await sendChatRequest({
            shytextId: hello.id,
            shytextMessage: hello.message,
            shytextIntent: hello.intent,
            receiverId: hello.authorId,
            venueId: hello.venueId,
            venueName: venue?.name,
            senderName: profile.displayName,
            introMessage: intro,
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setNotice('Hi sent. They’ll see it in Requests.');
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
  content: { padding: 20, paddingBottom: 140, gap: 12 },
  title: { fontSize: 30, fontWeight: '800' },
  own: { borderRadius: 20, padding: 16, gap: 8 },
  ownIntent: { fontSize: 20, fontWeight: '800' },
  ownActions: { gap: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabPlus: { color: '#fff', fontSize: 22, fontWeight: '800' },
  fabText: { color: '#fff', fontWeight: '700' },
});
