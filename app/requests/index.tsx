import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { respondToRequest } from '../../services/chat';
import { useState } from 'react';

export default function RequestsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.back, { color: theme.accent }]} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>Requests</Text>
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {incoming.length === 0 ? (
          <EmptyState
            theme={theme}
            title="No hellos yet"
            body="When someone responds to your ShyText, it shows up here."
          />
        ) : (
          incoming.map((request) => (
            <View key={request.id} style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.name, { color: theme.text }]}>{request.senderName}</Text>
              <Text style={{ color: theme.muted }}>Responded to:</Text>
              <Text style={{ color: theme.text, fontWeight: '600' }}>“{request.shytextMessage}”</Text>
              {request.introMessage ? (
                <>
                  <Text style={{ color: theme.muted, marginTop: 8 }}>Message:</Text>
                  <Text style={{ color: theme.text }}>“{request.introMessage}”</Text>
                </>
              ) : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Decline"
                    theme={theme}
                    variant="ghost"
                    onPress={async () => {
                      await respondToRequest(request, false);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Accept"
                    theme={theme}
                    onPress={async () => {
                      try {
                        const id = await respondToRequest(request, true);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        if (id) router.replace(`/chat/${id}`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not accept.');
                      }
                    }}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  back: { fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '800' },
  card: { borderRadius: 20, padding: 16, gap: 6 },
  name: { fontSize: 20, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
