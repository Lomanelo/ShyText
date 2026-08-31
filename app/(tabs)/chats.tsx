import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { PressScale } from '../../components/PressScale';
import { type, useTheme } from '../../theme';
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
        <PressScale onPress={() => router.push('/requests')} style={[styles.requests, { backgroundColor: theme.card }]}>
          <Text style={[type.headline, { color: theme.text, flex: 1 }]}>Requests</Text>
          {incoming.length ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.onAccent }]}>{incoming.length}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={theme.quiet} />
        </PressScale>

        {conversations.length === 0 ? (
          <EmptyState
            theme={theme}
            title="No chats yet"
            action={{ label: 'Nearby', onPress: () => router.push('/(tabs)/nearby') }}
          />
        ) : (
          <View style={[styles.group, { backgroundColor: theme.card }]}>
            {conversations.map((convo, index) => {
              const unread = convo.lastSenderId && convo.lastSenderId !== user?.uid;
              return (
                <Pressable
                  key={convo.id}
                  onPress={() => router.push(`/chat/${convo.id}`)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: pressed ? theme.bg : 'transparent' },
                    index < conversations.length - 1
                      ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                      : null,
                  ]}
                >
                  <Avatar name={names[convo.id] || convo.venueName || 'Chat'} theme={theme} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.headline, { color: theme.text }]}>{names[convo.id] || 'Private chat'}</Text>
                    <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                      {convo.lastMessage}
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
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  requests: {
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  group: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
