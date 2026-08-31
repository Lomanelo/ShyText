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
import { doc, getDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ReportModal } from '../../components/ReportModal';
import { PressScale } from '../../components/PressScale';
import { type, useTheme } from '../../theme';
import { springLayout } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ChatMessage, Conversation } from '../../types/chat';
import { closeConversation, listenMessages, sendMessage } from '../../services/chat';
import { getUserProfile } from '../../services/auth';
import { blockUser } from '../../services/blocks';
import { MAX_MESSAGE_LENGTH } from '../../utils/config';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const reduce = useReduceMotion();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherName, setOtherName] = useState('Chat');
  const [otherId, setOtherId] = useState<string>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    getDoc(doc(db, 'conversations', chatId)).then(async (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Conversation;
      const other = data.participantIds.find((id) => id !== user?.uid);
      setOtherId(other);
      if (other) {
        const profile = await getUserProfile(other);
        setOtherName(profile?.displayName ?? 'Someone');
      }
    });
    return listenMessages(chatId, setMessages);
  }, [chatId, user?.uid]);

  const post = async () => {
    if (!chatId || !text.trim()) return;
    try {
      await sendMessage(chatId, text);
      setText('');
      setError(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen
        options={{
          title: otherName,
          headerRight: () => (
            <Pressable
              accessibilityLabel="More"
              onPress={() => {
                Alert.alert(otherName, undefined, [
                  { text: 'Report', onPress: () => setReport(true) },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                      if (chatId) await closeConversation(chatId);
                      router.back();
                    },
                  },
                  ...(otherId && user
                    ? [
                        {
                          text: 'Block',
                          style: 'destructive' as const,
                          onPress: async () => {
                            await blockUser(user.uid, otherId);
                            if (chatId) await closeConversation(chatId);
                            router.back();
                          },
                        },
                      ]
                    : []),
                  { text: 'Cancel', style: 'cancel' },
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
        <View style={[styles.composer, { backgroundColor: theme.card, marginBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Message"
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
            accessibilityLabel="Send"
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
});
