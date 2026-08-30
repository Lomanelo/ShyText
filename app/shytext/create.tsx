import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { createShyText } from '../../services/shytexts';
import { SHYTEXT_CATEGORIES, ShyTextCategory } from '../../types/shytext';
import { MAX_MESSAGE_LENGTH } from '../../utils/config';

const LABELS: Record<ShyTextCategory, string> = {
  chat: '💬 Chat',
  play: '🎲 Play',
  social: '🍻 Social',
  study: '📚 Study',
  watch: '⚽ Watch',
  network: '🤝 Network',
  game: '🎮 Game',
  other: '✨ Other',
};

export default function CreateShyTextScreen() {
  const theme = useTheme();
  const { venueId: paramVenueId } = useLocalSearchParams<{ venueId?: string }>();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const [category, setCategory] = useState<ShyTextCategory>('chat');
  const [message, setMessage] = useState('');
  const [ttl, setTtl] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venue = current.venue;
  const venueId = paramVenueId || venue?.id;
  const canPost = useMemo(
    () => !!current.checkIn && !current.expired && current.checkIn.venueId === venueId,
    [current.checkIn, current.expired, venueId]
  );

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Leave a ShyText</Text>
        <Text style={{ color: theme.muted }}>Say something to the room.</Text>

        <View style={styles.chips}>
          {SHYTEXT_CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.chip,
                { backgroundColor: item === category ? theme.accent : theme.card },
              ]}
            >
              <Text style={{ color: item === category ? '#fff' : theme.text, fontWeight: '700' }}>
                {LABELS[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={message}
          onChangeText={setMessage}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          placeholder="Anyone want to play dominoes?"
          placeholderTextColor={theme.quiet}
          style={[styles.area, { backgroundColor: theme.card, color: theme.text }]}
        />
        <Text style={{ color: theme.quiet, alignSelf: 'flex-end' }}>
          {message.length}/{MAX_MESSAGE_LENGTH}
        </Text>

        <View style={styles.row}>
          {[15, 30, 60].map((mins) => (
            <Pressable
              key={mins}
              onPress={() => setTtl(mins)}
              style={[styles.ttl, { backgroundColor: ttl === mins ? theme.accentSoft : theme.card }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {mins === 60 ? '1 hour' : `${mins} min`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: theme.muted }}>
          Posting at:{'\n'}
          <Text style={{ color: theme.text, fontWeight: '800' }}>{venue?.name ?? 'Unknown venue'}</Text>
        </Text>
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {!canPost ? (
          <Text style={{ color: theme.danger }}>Check in to this venue first.</Text>
        ) : null}

        <PrimaryButton
          title="Post ShyText"
          theme={theme}
          disabled={!canPost || !message.trim()}
          loading={busy}
          onPress={async () => {
            if (!venueId || !profile) return;
            setBusy(true);
            setError(null);
            try {
              await createShyText({
                venueId,
                message,
                category,
                ttlMinutes: ttl,
                authorName: profile.displayName,
                authorAvatarUrl: profile.avatarUrl,
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not post.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 30, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  area: { minHeight: 140, borderRadius: 18, padding: 16, textAlignVertical: 'top', fontSize: 18 },
  row: { flexDirection: 'row', gap: 8 },
  ttl: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
});
