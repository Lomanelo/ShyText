import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useLocation } from '../../hooks/useLocation';
import { activateShyText } from '../../services/shytexts';
import { getVenue } from '../../services/venues';
import { Venue } from '../../types/venue';
import { normalizeVibe, SHYTEXT_VIBES, ShyTextVibe, VIBE_LABELS } from '../../types/shytext';
import { DEFAULT_SHYTEXT_MINUTES, MAX_SHYTEXT_MESSAGE_LENGTH } from '../../utils/config';

export default function DropShyTextScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ venueId?: string; vibe?: string; message?: string }>();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const [vibe, setVibe] = useState<ShyTextVibe>(normalizeVibe(params.vibe));
  const [message, setMessage] = useState(params.message ?? '');
  const [ttl, setTtl] = useState(DEFAULT_SHYTEXT_MINUTES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<Venue | null>(current.venue);

  const venueId = params.venueId || venue?.id;

  useEffect(() => {
    if (!params.venueId) return;
    if (current.venue?.id === params.venueId) {
      setVenue(current.venue);
      return;
    }
    getVenue(params.venueId).then((found) => {
      if (found) setVenue(found);
    });
  }, [params.venueId, current.venue]);

  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Drop a ShyText</Text>
        <Text style={{ color: theme.muted }}>
          You’re here, you’re open to being approached, and this is what you’re up for.
        </Text>

        <Text style={{ color: theme.text, fontWeight: '700' }}>Vibe</Text>
        <View style={styles.chips}>
          {SHYTEXT_VIBES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setVibe(item)}
              style={[styles.chip, { backgroundColor: item === vibe ? theme.accent : theme.card }]}
            >
              <Text style={{ color: item === vibe ? '#fff' : theme.text, fontWeight: '700' }}>
                {VIBE_LABELS[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: theme.text, fontWeight: '700' }}>Message · optional</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          maxLength={MAX_SHYTEXT_MESSAGE_LENGTH}
          multiline
          placeholder="Waiting for a friend, happy to chat."
          placeholderTextColor={theme.quiet}
          style={[styles.area, { backgroundColor: theme.card, color: theme.text }]}
        />
        <Text style={{ color: theme.quiet, alignSelf: 'flex-end' }}>
          {message.length}/{MAX_SHYTEXT_MESSAGE_LENGTH}
        </Text>

        <View style={styles.row}>
          {[15, 30, 60].map((mins) => (
            <Pressable
              key={mins}
              onPress={() => setTtl(mins)}
              style={[styles.ttl, { backgroundColor: ttl === mins ? theme.accentSoft : theme.card }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {mins === 60 ? '1h' : `${mins}m`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: theme.muted }}>
          Visible at{'\n'}
          <Text style={{ color: theme.text, fontWeight: '800' }}>{venue?.name ?? 'this venue'}</Text>
        </Text>
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

        <PrimaryButton
          title="Drop a ShyText"
          theme={theme}
          loading={busy}
          onPress={async () => {
            if (!venueId || !profile) return;
            setBusy(true);
            setError(null);
            try {
              const coords =
                current.checkIn?.venueId === venueId && !current.expired
                  ? null
                  : await refresh();
              await activateShyText({
                venueId,
                vibe,
                message: message.trim() || undefined,
                ttlMinutes: ttl,
                authorName: profile.displayName,
                authorAvatarUrl: profile.avatarUrl,
                authorAge: profile.age,
                authorBio: profile.bio,
                venue: venue ?? undefined,
                userLat: coords?.latitude,
                userLon: coords?.longitude,
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not drop a ShyText.');
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
  area: { minHeight: 88, borderRadius: 18, padding: 16, textAlignVertical: 'top', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  ttl: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
});
