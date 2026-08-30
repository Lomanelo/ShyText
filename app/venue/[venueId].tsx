import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { ShyTextCard } from '../../components/ShyTextCard';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { ChatRequestModal } from '../../components/ChatRequestModal';
import { ReportModal } from '../../components/ReportModal';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useShyTexts } from '../../hooks/useShyTexts';
import { getVenue } from '../../services/venues';
import { deleteOwnShyText } from '../../services/shytexts';
import { sendChatRequest } from '../../services/chat';
import { Venue } from '../../types/venue';
import { ShyTextPost } from '../../types/shytext';

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
        <Text style={{ color: theme.muted }}>
          {posts.length} ShyText{posts.length === 1 ? '' : 's'} right now
        </Text>
        {!checkedIn ? (
          <Text style={{ color: theme.danger }}>
            Check in on Nearby to post here. You can still browse.
          </Text>
        ) : null}

        {notice ? <Text style={{ color: theme.accent }}>{notice}</Text> : null}

        {loading && !posts.length ? <Skeleton theme={theme} /> : null}

        {!loading && posts.length === 0 ? (
          <EmptyState
            theme={theme}
            title="It's quiet here 👀"
            body="Be the first to say something."
            action={
              checkedIn
                ? { label: 'Leave a ShyText', onPress: () => router.push('/shytext/create') }
                : undefined
            }
          />
        ) : (
          posts.map((post) => (
            <ShyTextCard
              key={post.id}
              post={post}
              theme={theme}
              isOwn={post.authorId === user?.uid}
              onHello={() => {
                if (post.authorId.startsWith('seed-')) {
                  setNotice('This is a demo ShyText. Post your own to try a real hello.');
                  return;
                }
                setHello(post);
              }}
              onReport={() => setReport(post)}
              onDelete={async () => {
                await deleteOwnShyText(post.id);
                await Haptics.selectionAsync();
              }}
            />
          ))
        )}
      </ScrollView>

      {checkedIn ? (
        <Pressable
          accessibilityLabel="Leave a ShyText"
          onPress={() => router.push({ pathname: '/shytext/create', params: { venueId } })}
          style={[styles.fab, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.fabPlus}>+</Text>
          <Text style={styles.fabText}>Leave a ShyText</Text>
        </Pressable>
      ) : null}

      <ChatRequestModal
        visible={!!hello}
        name={hello?.authorName ?? ''}
        theme={theme}
        onClose={() => setHello(null)}
        onSend={async (intro) => {
          if (!hello || !profile) throw new Error('Sign in first.');
          await sendChatRequest({
            shytextId: hello.id,
            shytextMessage: hello.message,
            receiverId: hello.authorId,
            venueId: hello.venueId,
            venueName: venue?.name,
            senderName: profile.displayName,
            introMessage: intro,
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setNotice('Hello sent. They’ll see it in Requests.');
        }}
      />
      <ReportModal
        visible={!!report}
        onClose={() => setReport(null)}
        theme={theme}
        targetType="shytext"
        targetId={report?.id ?? ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 140, gap: 12 },
  title: { fontSize: 30, fontWeight: '800' },
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
