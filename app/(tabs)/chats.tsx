import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { useTheme } from '../../theme';
import { type } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { useChats } from '../../hooks/useChats';
import { timeAgo } from '../../utils/dates';
import { getUserProfile } from '../../services/auth';

export default function ChatsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);
  const { conversations } = useChats(user?.uid);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const convo of conversations) {
        const other = convo.participantIds.find((id) => id !== user.uid);
        if (!other) continue;
        const profile = await getUserProfile(other);
        next[convo.id] = profile?.displayName ?? 'Someone';
      }
      if (!cancelled) setNames(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, user]);

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Pressable onPress={() => router.push('/requests')} style={[styles.requests, { backgroundColor: theme.accentSoft }]}>
          <Text style={[type.headline, { color: theme.accent }]}>
            Requests {incoming.length ? `(${incoming.length})` : ''}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]}>Icebreakers waiting for you</Text>
        </Pressable>

        {conversations.length === 0 ? (
          <EmptyState
            theme={theme}
            title="Nothing happening yet"
            body="Drop a ShyText at a venue. If someone breaks the ice, you’ll talk here."
            action={{ label: 'Go nearby', onPress: () => router.push('/(tabs)/nearby') }}
          />
        ) : (
          conversations.map((convo) => {
            const unread = convo.lastSenderId && convo.lastSenderId !== user?.uid;
            return (
              <Pressable
                key={convo.id}
                onPress={() => router.push(`/chat/${convo.id}`)}
                style={[styles.card, { backgroundColor: theme.card }]}
              >
                <Avatar name={names[convo.id] || convo.venueName || 'Chat'} theme={theme} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.headline, { color: theme.text }]}>{names[convo.id] || 'Private chat'}</Text>
                  <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                    {convo.lastMessage || 'Break the ice'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[type.caption, { color: theme.quiet, fontVariant: ['tabular-nums'] }]}>
                    {timeAgo(convo.lastMessageAt)}
                  </Text>
                  {unread ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  requests: { borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
