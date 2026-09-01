import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ReportModal } from '../../components/ReportModal';
import { PressScale } from '../../components/PressScale';
import { CountdownBadge } from '../../components/CountdownBadge';
import { radius, type, useTheme } from '../../theme';
import { springLayout } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { ChatMessage, Conversation } from '../../types/chat';
import { closeConversation, listenConversation, listenMessages, sendMessage } from '../../services/chat';
import { getUserProfile } from '../../services/auth';
import { blockUser } from '../../services/blocks';
import { MAX_MESSAGE_LENGTH } from '../../utils/config';
import { chatSendUntil, isChatSendingOpen } from '../../utils/chatTime';
import { useTranslation } from 'react-i18next';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [otherName, setOtherName] = useState(t('common.chat'));
  const [otherId, setOtherId] = useState<string>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const sendingOpen = convo ? isChatSendingOpen(convo) : false;

  useEffect(() => {
    if (!chatId) return;
    const unsubConvo = listenConversation(chatId, async (next) => {
      setConvo(next);
      const other = next?.participantIds.find((id) => id !== user?.uid);
      setOtherId(other);
      if (other) {
        const profile = await getUserProfile(other);
        setOtherName(profile?.displayName ?? t('common.someone'));
      }
    });
    const unsubMessages = listenMessages(chatId, setMessages);
    return () => {
      unsubConvo();
      unsubMessages();
    };
  }, [chatId, user?.uid]);

  const post = async () => {
    if (!chatId || !text.trim() || !sendingOpen) return;
    try {
      await sendMessage(chatId, text);
      setText('');
      setError(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotSend'));
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen
        options={{
          title: otherName,
          headerRight: () => (
            <Pressable
              accessibilityLabel={t('common.more')}
              onPress={() => {
                Alert.alert(otherName, undefined, [
                  { text: t('common.report'), onPress: () => setReport(true) },
                  {
                    text: t('common.leave'),
                    style: 'destructive',
                    onPress: async () => {
                      if (chatId) await closeConversation(chatId);
                      router.back();
                    },
                  },
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
              style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
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
        <ScrollView contentContainerStyle={styles.thread} contentInsetAdjustmentBehavior="automatic">
          {messages.map((item) => {
            const mine = item.senderId === user?.uid;
            return (
              <Animated.View
                key={item.id}
                layout={reduce ? undefined : springLayout()}
                style={[
                  styles.bubble,
                  mine ? styles.mine : styles.theirs,
                  {
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? theme.accent : theme.card,
                  },
                ]}
              >
                <Text style={[type.body, { color: mine ? theme.onAccent : theme.text }]}>{item.text}</Text>
              </Animated.View>
            );
          })}
        </ScrollView>
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger, paddingHorizontal: 16 }]}>
            {error}
          </Text>
        ) : null}
        {convo && sendingOpen ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' }}>
            <CountdownBadge expiresAt={chatSendUntil(convo)} theme={theme} />
          </View>
        ) : null}
        {!convo ? null : sendingOpen ? (
          <View style={[styles.composer, { backgroundColor: theme.card, marginBottom: Math.max(insets.bottom, 12) }]}>
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
              style={[
                styles.send,
                { backgroundColor: text.trim() ? theme.accent : theme.border },
              ]}
              onPress={() => {
                void post();
              }}
            >
              <Ionicons name="arrow-up" size={18} color={text.trim() ? theme.onAccent : theme.quiet} />
            </PressScale>
          </View>
        ) : (
          <View
            style={[
              styles.irl,
              { backgroundColor: theme.card, marginBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Text style={[type.headline, { color: theme.text, textAlign: 'center' }]}>{t('chats.timeToTalk')}</Text>
            <Text style={[type.body, { color: theme.muted, textAlign: 'center' }]}>
              {t('chats.closedBody')}
            </Text>
          </View>
        )}
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
  thread: { padding: 16, gap: 8, flexGrow: 1 },
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
  irl: {
    marginHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
});
