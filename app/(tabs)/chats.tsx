import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { RequestCard } from '../../components/RequestCard';
import { type, useTheme } from '../../theme';
import { springLayout, springSlideOutRight } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { useChats } from '../../hooks/useChats';
import { getUserProfile } from '../../services/auth';
import { prefetchProfileImage } from '../../services/imageCache';
import {
  deleteConversationForMe,
  ensureConversationOpen,
  isConversationPinnedBy,
  isConversationUnread,
  respondToRequest,
  setConversationPinned,
} from '../../services/chat';
import { ChatRequest, Conversation } from '../../types/chat';
import { PressScale } from '../../components/PressScale';
import { icebreakerFromKey } from '../../i18n/labels';
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

  /** Long-press: pin favorites to the top, or delete the chat from your list. */
  const showChatOptions = useCallback(
    (convo: Conversation, label: string) => {
      if (!user) return;
      const pinned = isConversationPinnedBy(convo, user.uid);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(label, undefined, [
        {
          text: pinned ? t('chats.unpin') : t('chats.pin'),
          onPress: () => {
            void setConversationPinned(convo.id, !pinned).catch(() => undefined);
          },
        },
        {
          text: t('chats.deleteChat'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('chats.deleteChatTitle'), t('chats.deleteChatBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                  void deleteConversationForMe(convo.id).catch(() =>
                    setError(t('errors.couldNotSave'))
                  );
                },
              },
            ]);
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [user, t]
  );

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={[styles.content, empty ? styles.contentEmpty : null]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}

        {empty ? (
          <EmptyState
            theme={theme}
            art="chats"
            fill
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
                const unread = user ? isConversationUnread(convo, user.uid) : false;
                const pinned = user ? isConversationPinnedBy(convo, user.uid) : false;
                const label = names[convo.id] || t('chats.privateChat');
                return (
                  <PressScale
                    key={convo.id}
                    onPress={() => {
                      void ensureConversationOpen(convo.id)
                        .then((id) => router.push(`/chat/${id}`))
                        .catch(() => router.push(`/chat/${convo.id}`));
                    }}
                    onLongPress={() => showChatOptions(convo, label)}
                    accessibilityHint={t('chats.rowOptionsHint')}
                    style={[
                      styles.card,
                      index < conversations.length - 1
                        ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                        : null,
                    ]}
                  >
                    <Avatar
                      name={label}
                      uri={avatars[convo.id]}
                      userId={convo.participantIds.find((id) => id !== user?.uid)}
                      theme={theme}
                      size={48}
                    />
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[type.headline, { color: theme.text, flexShrink: 1 }]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        {pinned ? <Ionicons name="pin" size={13} color={theme.quiet} /> : null}
                      </View>
                      <Text
                        style={[
                          type.caption,
                          { color: unread ? theme.text : theme.muted },
                          unread ? { fontWeight: '600' } : null,
                        ]}
                        numberOfLines={1}
                      >
                        {(convo.lastMessage === convo.introMessage
                          ? icebreakerFromKey(convo.introMessageKey)
                          : undefined) ??
                          convo.lastMessage ??
                          t('chats.privateChat')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {unread ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                      <Ionicons name="chevron-forward" size={16} color={theme.quiet} />
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
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
  group: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
