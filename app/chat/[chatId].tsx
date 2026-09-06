import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ReportModal } from '../../components/ReportModal';
import { PressScale } from '../../components/PressScale';
import { Avatar } from '../../components/Avatar';
import { type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { ChatMessage, Conversation } from '../../types/chat';
import { closeConversation, ensureConversationOpen, listenConversation, listenMessages, sendMessage } from '../../services/chat';
import { setOpenChatId } from '../../services/openChat';
import { getUserProfile } from '../../services/auth';
import { rememberImage } from '../../services/imageCache';
import { blockUser } from '../../services/blocks';
import { MAX_MESSAGE_LENGTH } from '../../utils/config';
import { icebreakerFromKey } from '../../i18n/labels';
import { useTranslation } from 'react-i18next';

type Row = ChatMessage & { pending?: boolean };

function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const list = useRef<FlatList<Row>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Row[]>([]);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [otherName, setOtherName] = useState(t('common.chat'));
  const [otherAvatar, setOtherAvatar] = useState<string>();
  const [otherId, setOtherId] = useState<string>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const canSend = Boolean(convo);

  useEffect(() => {
    if (!chatId) return;
    setOpenChatId(chatId);
    return () => setOpenChatId(null);
  }, [chatId]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!chatId || !convo || convo.status !== 'closed') return;
    void ensureConversationOpen(chatId).catch(() => undefined);
  }, [chatId, convo]);

  useEffect(() => {
    if (!chatId) return;
    const unsubConvo = listenConversation(chatId, async (next) => {
      setConvo(next);
      const other = next?.participantIds.find((id) => id !== user?.uid);
      setOtherId(other);
      if (next?.otherName) setOtherName(next.otherName);
      if (next?.otherAvatarUrl) {
        rememberImage([next.otherAvatarUrl], next.otherAvatarUrl);
        setOtherAvatar(next.otherAvatarUrl);
      }
      if (other) {
        const profile = await getUserProfile(other).catch(() => null);
        setOtherName(profile?.displayName ?? next?.otherName ?? t('common.someone'));
        if (profile?.avatarUrl) {
          rememberImage([other, profile.avatarUrl], profile.avatarUrl);
          setOtherAvatar(profile.avatarUrl);
        }
      }
    });
    const unsubMessages = listenMessages(chatId, (next) => {
      setMessages(next);
      setPending((rows) =>
        rows.filter((row) => !next.some((item) => item.senderId === row.senderId && item.text === row.text))
      );
    });
    return () => {
      unsubConvo();
      unsubMessages();
    };
  }, [chatId, user?.uid, t]);

  const rows = useMemo<Row[]>(() => {
    const rawIntro = convo?.introMessage?.trim();
    // Suggested icebreakers carry a key — show them in the viewer's language.
    const introText = icebreakerFromKey(convo?.introMessageKey) ?? rawIntro;
    const seeded: Row[] = [];
    if (convo && rawIntro && introText) {
      const alreadyInThread = messages.some(
        (item) => item.text === rawIntro && (!convo.introSenderId || item.senderId === convo.introSenderId)
      );
      if (!alreadyInThread) {
        seeded.push({
          id: `intro:${convo.id}`,
          conversationId: convo.id,
          senderId: convo.introSenderId ?? convo.participantIds[0],
          text: introText,
          createdAt: convo.createdAt,
        });
      }
    }
    return [...seeded, ...messages, ...pending];
  }, [messages, pending, convo]);

  const post = async () => {
    const body = text.trim();
    if (!chatId || !body || !canSend || !user) return;
    const local: Row = {
      id: `pending:${Date.now()}`,
      conversationId: chatId,
      senderId: user.uid,
      text: body,
      createdAt: Date.now(),
      pending: true,
    };
    setPending((prev) => [...prev, local]);
    setText('');
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
    try {
      await sendMessage(chatId, body);
    } catch (err) {
      setPending((prev) => prev.filter((item) => item.id !== local.id));
      setText(body);
      setError(err instanceof Error ? err.message : t('errors.couldNotSend'));
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.head}>
              <Avatar name={otherName} uri={otherAvatar} userId={otherId} theme={theme} size={28} />
              <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
                {otherName}
              </Text>
            </View>
          ),
          headerRight: () => (
            <Pressable
              accessibilityLabel={t('common.more')}
              onPress={() => {
                Alert.alert(otherName, undefined, [
                  { text: t('common.report'), onPress: () => setReport(true) },
                  ...(otherId && user
                    ? [
                        {
                          text: t('common.block'),
                          style: 'destructive' as const,
                          onPress: async () => {
                            await blockUser(user.uid, otherId);
                            if (chatId) await closeConversation(chatId);
                            router.back();
                          },
                        },
                      ]
                    : []),
                  { text: t('common.cancel'), style: 'cancel' },
                ]);
              }}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.quiet} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.thread}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.uid;
            const prev = rows[index - 1];
            const showTime = !prev || item.createdAt - prev.createdAt > 5 * 60_000;
            const stacked = prev && prev.senderId === item.senderId && !showTime;
            return (
              <View style={{ gap: 6 }}>
                {showTime ? (
                  <Text style={[type.caption, { color: theme.quiet, textAlign: 'center', marginVertical: 8 }]}>
                    {timeLabel(item.createdAt)}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.line,
                    { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: stacked ? 2 : 6 },
                  ]}
                >
                  {!mine ? (
                    <View style={{ width: 28, marginRight: 6 }}>
                      {stacked ? null : <Avatar name={otherName} uri={otherAvatar} userId={otherId} theme={theme} size={28} />}
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.mine : styles.theirs,
                      {
                        backgroundColor: mine ? theme.accent : theme.card,
                        opacity: item.pending ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[type.body, { color: mine ? theme.onAccent : theme.text }]}>{item.text}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger, paddingHorizontal: 16 }]}>
            {error}
          </Text>
        ) : null}
        {canSend ? (
          <View
            style={[
              styles.composer,
              {
                backgroundColor: theme.card,
                // Safe-area only when keyboard is closed; KAV already lifts above keyboard.
                marginBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 12),
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={t('chats.message')}
              placeholderTextColor={theme.quiet}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                void post();
              }}
              style={[styles.input, { color: theme.text }]}
            />
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}
              disabled={!text.trim()}
              hitSlop={4}
              style={[styles.send, { backgroundColor: text.trim() ? theme.accent : theme.border }]}
              onPress={() => {
                void post();
              }}
            >
              <Ionicons name="arrow-up" size={18} color={text.trim() ? theme.onAccent : theme.quiet} />
            </PressScale>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ReportModal
        visible={report}
        onClose={() => setReport(false)}
        theme={theme}
        targetType={otherId ? 'user' : 'message'}
        targetId={otherId ?? chatId ?? ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220 },
  thread: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10 },
  mine: { borderBottomRightRadius: 5 },
  theirs: { borderBottomLeftRadius: 5 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: { flex: 1, minHeight: 40, fontSize: 17, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
