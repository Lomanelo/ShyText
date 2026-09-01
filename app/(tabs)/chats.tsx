import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CountdownBadge } from '../../components/CountdownBadge';
import { radius, type, useTheme } from '../../theme';
import { springLayout, springSlideOutRight } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { useChats } from '../../hooks/useChats';
import { chatSendUntil, isChatSendingOpen } from '../../utils/chatTime';
import { getUserProfile } from '../../services/auth';
import { respondToRequest } from '../../services/chat';
import { ChatRequest } from '../../types/chat';
import { useTranslation } from 'react-i18next';

export default function ChatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);
  const { conversations } = useChats(user?.uid);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const convo of conversations) {
        const other = convo.participantIds.find((id) => id !== user.uid);
        if (!other) continue;
        const profile = await getUserProfile(other);
        next[convo.id] = profile?.displayName ?? t('common.someone');
      }
      if (!cancelled) setNames(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, user]);

  const accept = async (request: ChatRequest) => {
    try {
      const id = await respondToRequest(request, true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (id) router.push(`/chat/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotAccept'));
    }
  };

  const empty = incoming.length === 0 && conversations.length === 0;

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}

        {empty ? (
          <EmptyState
            theme={theme}
            title={t('chats.emptyTitle')}
            body={t('chats.emptyBody')}
            action={{ label: t('tabs.nearby'), onPress: () => router.push('/(tabs)/nearby') }}
          />
        ) : null}

        {incoming.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[type.caption, { color: theme.quiet, paddingHorizontal: 4 }]}>{t('chats.requests')}</Text>
            {incoming.map((request) => (
              <Animated.View
                key={request.id}
                layout={reduce ? undefined : springLayout()}
                exiting={reduce ? undefined : springSlideOutRight()}
                style={[styles.request, { backgroundColor: theme.card }]}
              >
                <Text style={[type.headline, { color: theme.text }]}>{request.senderName}</Text>
                {request.venueName ? (
                  <Text style={[type.caption, { color: theme.quiet }]}>{request.venueName}</Text>
                ) : null}
                {request.introMessage ? (
                  <Text style={[type.body, { color: theme.text }]}>“{request.introMessage}”</Text>
                ) : null}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title={t('common.decline')}
                      theme={theme}
                      variant="ghost"
                      onPress={() => void respondToRequest(request, false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title={t('common.accept')} theme={theme} onPress={() => void accept(request)} />
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {conversations.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[type.caption, { color: theme.quiet, paddingHorizontal: 4 }]}>{t('tabs.chats')}</Text>
            <View style={[styles.group, { backgroundColor: theme.card }]}>
              {conversations.map((convo, index) => {
                const unread = convo.lastSenderId && convo.lastSenderId !== user?.uid;
                const open = isChatSendingOpen(convo);
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
                    <Avatar name={names[convo.id] || convo.venueName || t('common.chat')} theme={theme} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.headline, { color: theme.text }]}>{names[convo.id] || t('chats.privateChat')}</Text>
                      <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                        {open ? convo.lastMessage : t('chats.goTalk')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {open ? (
                        <CountdownBadge expiresAt={chatSendUntil(convo)} theme={theme} />
                      ) : (
                        <Text style={[type.caption, { color: theme.quiet }]}>{t('chats.wrapped')}</Text>
                      )}
                      {unread && open ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  request: { borderRadius: radius.lg, borderCurve: 'continuous', padding: 16, gap: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  group: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
