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
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { ReportModal } from '../../components/ReportModal';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
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
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.accent, fontWeight: '700' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{otherName}</Text>
            <Text style={{ color: theme.muted }}>{convo?.venueName}</Text>
          </View>
          <Pressable onPress={() => setReport(true)}>
            <Text style={{ color: theme.quiet }}>⋯</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.thread}>
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
                <Text style={{ color: mine ? '#fff' : theme.quiet, fontSize: 12, marginBottom: 4 }}>
                  {mine ? 'You' : otherName}
                </Text>
                <Text style={{ color: mine ? '#fff' : theme.text, fontSize: 16 }}>{item.text}</Text>
              </View>
            );
          })}
        </ScrollView>
        {error ? <Text style={{ color: theme.danger, paddingHorizontal: 16 }}>{error}</Text> : null}
        <View style={[styles.composer, { backgroundColor: theme.card }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Message..."
            placeholderTextColor={theme.quiet}
            style={[styles.input, { color: theme.text }]}
          />
          <Pressable
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
            <Text style={{ color: theme.accent, fontWeight: '800' }}>Send</Text>
          </Pressable>
        </View>
        <View style={{ padding: 12, gap: 8 }}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  name: { fontSize: 18, fontWeight: '800' },
  thread: { padding: 16, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 12 },
  composer: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 16, paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 48 },
});
