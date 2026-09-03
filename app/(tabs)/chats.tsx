import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { RequestCard } from '../../components/RequestCard';
import { CountdownBadge } from '../../components/CountdownBadge';
import { radius, type, useTheme } from '../../theme';
import { springLayout, springSlideOutRight } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { useChats } from '../../hooks/useChats';
import { chatSendUntil, isChatSendingOpen } from '../../utils/chatTime';
import { getUserProfile } from '../../services/auth';
import { prefetchProfileImage } from '../../services/imageCache';
import { ensureConversationOpen, respondToRequest } from '../../services/chat';
import { ChatRequest } from '../../types/chat';
import { PressScale } from '../../components/PressScale';
import { useTranslation } from 'react-i18next';

export default function ChatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);
  const { conversations } = useChats(user?.uid);
  const [names, setNames] = useState<Record<string, string>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const nextNames: Record<string, string> = {};
      const nextAvatars: Record<string, string> = {};
      for (const convo of conversations) {
        if (convo.otherName) nextNames[convo.id] = convo.otherName;
        if (convo.otherAvatarUrl) {
          nextAvatars[convo.id] = convo.otherAvatarUrl;
          prefetchProfileImage([convo.otherAvatarUrl], convo.otherAvatarUrl);
        }
        const other = convo.participantIds.find((id) => id !== user.uid);
        if (!other) continue;
        const profile = await getUserProfile(other).catch(() => null);
        if (cancelled) return;
        nextNames[convo.id] = profile?.displayName ?? nextNames[convo.id] ?? t('common.someone');
        if (profile?.avatarUrl) {
          nextAvatars[convo.id] = profile.avatarUrl;
          prefetchProfileImage([other, profile.avatarUrl], profile.avatarUrl);
        }
      }
      if (!cancelled) {
        setNames(nextNames);
        setAvatars(nextAvatars);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, user, t]);

  const visibleIncoming = useMemo(
    () => incoming.filter((item) => !hidden[item.id]),
    [incoming, hidden]
  );

  const hide = useCallback((id: string) => {
    setHidden((prev) => ({ ...prev, [id]: true }));
  }, []);

  const accept = async (request: ChatRequest) => {
    hide(request.id);
    setBusyId(request.id);
    setError(null);
    try {
      const id = await respondToRequest(request, true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (id) router.push(`/chat/${id}`);
    } catch (err) {
      setHidden((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      setError(err instanceof Error ? err.message : t('errors.couldNotAccept'));
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (request: ChatRequest) => {
    hide(request.id);
    setError(null);
    try {
      await respondToRequest(request, false);
      await Haptics.selectionAsync();
    } catch (err) {
      setHidden((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      setError(err instanceof Error ? err.message : t('errors.couldNotDecline'));
    }
  };

  const empty = visibleIncoming.length === 0 && conversations.length === 0;

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

        {visibleIncoming.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[type.caption, { color: theme.quiet, paddingHorizontal: 4 }]}>{t('chats.requests')}</Text>
            {visibleIncoming.map((request) => (
              <Animated.View
                key={request.id}
                layout={reduce ? undefined : springLayout()}
                exiting={reduce ? undefined : springSlideOutRight()}
              >
                <RequestCard
                  request={request}
                  theme={theme}
                  busy={busyId === request.id}
                  onAccept={() => void accept(request)}
                  onDecline={() => void decline(request)}
                />
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
                const ended = convo.status === 'closed';
                const open = !ended && isChatSendingOpen(convo);
                const label = names[convo.id] || t('chats.privateChat');
                return (
                  <PressScale
                    key={convo.id}
                    onPress={() => {
                      void ensureConversationOpen(convo.id)
                        .then((id) => router.push(`/chat/${id}`))
                        .catch(() => router.push(`/chat/${convo.id}`));
                    }}
                    style={[
                      styles.card,
                      index < conversations.length - 1
                        ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                        : null,
                      !open ? { opacity: 0.92 } : null,
                    ]}
                  >
                    <Avatar
                      name={label}
                      uri={avatars[convo.id]}
                      userId={convo.participantIds.find((id) => id !== user?.uid)}
                      theme={theme}
                      size={48}
                    />
                    <View style={{ flex: 1, gap: open ? 2 : 6, minWidth: 0 }}>
                      <Text
                        style={[type.headline, { color: open ? theme.text : theme.muted }]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                      {open ? (
                        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                          {convo.lastMessage}
                        </Text>
                      ) : (
                        <View
                          style={[styles.wrapChip, { backgroundColor: theme.accentSoft }]}
                          accessibilityRole="text"
                          accessibilityLabel={ended ? t('chats.ended') : t('chats.goTalk')}
                        >
                          <Ionicons
                            name={ended ? 'chatbubble-ellipses-outline' : 'walk-outline'}
                            size={14}
                            color={theme.accent}
                          />
                          <Text style={[styles.wrapChipText, { color: theme.accent }]} numberOfLines={1}>
                            {ended ? t('chats.ended') : t('chats.goTalk')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {open ? (
                        <CountdownBadge expiresAt={chatSendUntil(convo)} theme={theme} />
                      ) : (
                        <Text style={[type.caption, { color: theme.quiet, fontWeight: '600' }]}>
                          {ended ? t('chats.endedShort') : t('chats.wrapped')}
                        </Text>
                      )}
                      {unread && open ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                    </View>
                  </PressScale>
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
  group: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  wrapChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  wrapChipText: {
    ...type.caption,
    fontWeight: '700',
    fontStyle: 'italic',
    flexShrink: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
