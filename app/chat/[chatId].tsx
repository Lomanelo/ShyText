import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ReportModal } from '../../components/ReportModal';
import { PrimaryButton } from '../../components/PrimaryButton';
import { type, useTheme } from '../../theme';
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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [convo, setConvo] = useState<Conversation | null>(null);
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
      setConvo(data);
      const other = data.participantIds.find((id) => id !== user?.uid);
      setOtherId(other);
      if (other) {
        const profile = await getUserProfile(other);
        setOtherName(profile?.displayName ?? 'Someone');
      }
    });
    return listenMessages(chatId, setMessages);
  }, [chatId, user?.uid]);

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen
        options={{
          title: otherName,
          headerRight: () => (
            <Pressable
              accessibilityLabel="More"
              onPress={() => setReport(true)}
              hitSlop={8}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.quiet} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {convo?.venueName ? (
          <Text style={[type.caption, { color: theme.muted, textAlign: 'center', paddingTop: 8 }]}>
            {convo.venueName}
          </Text>
        ) : null}
        <ScrollView contentContainerStyle={styles.thread} contentInsetAdjustmentBehavior="automatic">
          {messages.map((item) => {
            const mine = item.senderId === user?.uid;
            return (
              <View
                key={item.id}
                style={[
                  styles.bubble,
                  {
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? theme.accent : theme.card,
                  },
                ]}
              >
                <Text style={{ color: mine ? theme.onAccent : theme.quiet, fontSize: 12, marginBottom: 4 }}>
                  {mine ? 'You' : otherName}
                </Text>
                <Text style={[type.body, { color: mine ? theme.onAccent : theme.text }]}>{item.text}</Text>
              </View>
            );
          })}
        </ScrollView>
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger, paddingHorizontal: 16 }]}>
            {error}
          </Text>
        ) : null}
        <View style={[styles.composer, { backgroundColor: theme.card }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Message"
            placeholderTextColor={theme.quiet}
            style={[styles.input, { color: theme.text }]}
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
            onPress={async () => {
              if (!chatId || !text.trim()) return;
              try {
                await sendMessage(chatId, text);
                setText('');
                setError(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not send.');
              }
            }}
          >
            <Text style={[type.headline, { color: theme.accent }]}>Send</Text>
          </Pressable>
        </View>
        <View style={{ padding: 12, gap: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
          <PrimaryButton
            title="Leave conversation"
            theme={theme}
            variant="ghost"
            onPress={async () => {
              if (chatId) await closeConversation(chatId);
              router.back();
            }}
          />
          {otherId && user ? (
            <PrimaryButton
              title="Block"
              theme={theme}
              variant="danger"
              onPress={async () => {
                await blockUser(user.uid, otherId);
                if (chatId) await closeConversation(chatId);
                router.back();
              }}
            />
          ) : null}
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
  thread: { padding: 16, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: '80%', borderRadius: 18, borderCurve: 'continuous', padding: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
  },
  input: { flex: 1, minHeight: 48, fontSize: 17 },
});
