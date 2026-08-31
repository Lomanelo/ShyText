import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { radius, type, useTheme } from '../../theme';
import { springLayout, springSlideOutRight } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';
import { respondToRequest } from '../../services/chat';
import { useState } from 'react';

export default function RequestsScreen() {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {error ? (
          <Text selectable style={[type.body, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}
        {incoming.length === 0 ? (
          <EmptyState
            theme={theme}
            title="No ShyTexts"
            body="When someone at your venue sends you one, it shows up here."
          />
        ) : (
          incoming.map((request) => (
            <Animated.View
              key={request.id}
              layout={reduce ? undefined : springLayout()}
              exiting={reduce ? undefined : springSlideOutRight()}
              style={[styles.card, { backgroundColor: theme.card }]}
            >
              <Text style={[type.title, { color: theme.text }]}>{request.senderName}</Text>
              {request.introMessage ? (
                <Text style={[type.body, { color: theme.text }]}>“{request.introMessage}”</Text>
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
            </Animated.View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  card: { borderRadius: radius.lg, borderCurve: 'continuous', padding: 16, gap: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
