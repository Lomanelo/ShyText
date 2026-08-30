import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { activateShyText } from '../../services/shytexts';
import { INTENT_LABELS, normalizeIntent, SHYTEXT_INTENTS, ShyTextIntent } from '../../types/shytext';
import { MAX_SHYTEXT_MESSAGE_LENGTH } from '../../utils/config';

export default function GoVisibleScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ venueId?: string; intent?: string; message?: string }>();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const [intent, setIntent] = useState<ShyTextIntent>(normalizeIntent(params.intent));
  const [message, setMessage] = useState(params.message ?? '');
  const [ttl, setTtl] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venue = current.venue;
  const venueId = params.venueId || venue?.id;
  const canActivate = useMemo(
    () => !!current.checkIn && !current.expired && current.checkIn.venueId === venueId,
    [current.checkIn, current.expired, venueId]
  );

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>What are you up for?</Text>
        <Text style={{ color: theme.muted }}>You’ll only be visible at this venue, and only until time runs out.</Text>

        <View style={styles.chips}>
          {SHYTEXT_INTENTS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setIntent(item)}
              style={[styles.chip, { backgroundColor: item === intent ? theme.accent : theme.card }]}
            >
              <Text style={{ color: item === intent ? '#fff' : theme.text, fontWeight: '700' }}>
                {INTENT_LABELS[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: theme.text, fontWeight: '700' }}>Say something</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          maxLength={MAX_SHYTEXT_MESSAGE_LENGTH}
          multiline
          placeholder="Come say hi 👋"
          placeholderTextColor={theme.quiet}
          style={[styles.area, { backgroundColor: theme.card, color: theme.text }]}
        />
        <Text style={{ color: theme.quiet, alignSelf: 'flex-end' }}>
          {message.length}/{MAX_SHYTEXT_MESSAGE_LENGTH} · optional
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
          Visible at{'\n'}
          <Text style={{ color: theme.text, fontWeight: '800' }}>{venue?.name ?? 'Unknown venue'}</Text>
        </Text>
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {!canActivate ? <Text style={{ color: theme.danger }}>Check in to this venue first.</Text> : null}

        <PrimaryButton
          title="Go visible"
          theme={theme}
          disabled={!canActivate}
          loading={busy}
          onPress={async () => {
            if (!venueId || !profile) return;
            setBusy(true);
            setError(null);
            try {
              await activateShyText({
                venueId,
                intent,
                message: message.trim() || undefined,
                ttlMinutes: ttl,
                authorName: profile.displayName,
                authorAvatarUrl: profile.avatarUrl,
                authorAge: profile.age,
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not go visible.');
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
  area: { minHeight: 100, borderRadius: 18, padding: 16, textAlignVertical: 'top', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  ttl: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
});
