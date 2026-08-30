import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { VenueCard } from '../../components/VenueCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { getPlacesProvider } from '../../services/places';
import { countActiveShyTexts } from '../../services/shytexts';
import { Venue } from '../../types/venue';
import { distanceBetween } from '../../utils/geo';
import { isDevToolsEnabled } from '../../utils/config';
import { timeLeft } from '../../utils/dates';

export default function NearbyScreen() {
  const theme = useTheme();
  const { coords, status, error: locationError, busy, refresh } = useLocation();
  const current = useCurrentVenue();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await refresh();
      if (!next && !isDevToolsEnabled()) {
        setLoading(false);
        return;
      }
      const lat = next?.latitude ?? 48.853;
      const lon = next?.longitude ?? 2.35;
      const nearby = await getPlacesProvider().getNearbyVenues(lat, lon);
      const withCounts = await Promise.all(
        nearby.map(async (venue) => ({
          ...venue,
          activeCount: await countActiveShyTexts(venue.id),
        }))
      );
      setVenues(withCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load venues.');
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async (venue: Venue) => {
    try {
      const next = coords ?? (await refresh());
      await current.checkInHere(venue, next?.latitude, next?.longitude);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/venue/${venue.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  if (!coords && status !== 'granted' && !venues.length && !isDevToolsEnabled()) {
    return (
      <Screen theme={theme}>
        <LocationPermission theme={theme} error={locationError} busy={busy} onAllow={load} />
      </Screen>
    );
  }

  const checkedIn = current.venue && current.checkIn && !current.expired;

  return (
    <Screen theme={theme}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={[styles.wordmark, { color: theme.accent }]}>shytext</Text>
        <Text style={[styles.title, { color: theme.text }]}>Nearby</Text>

        {checkedIn ? (
          <Pressable
            onPress={() => router.push(`/venue/${current.venue!.id}`)}
            style={[styles.here, { backgroundColor: theme.accentSoft }]}
          >
            <Text style={{ color: theme.muted }}>You're at</Text>
            <Text style={[styles.hereName, { color: theme.text }]}>{current.venue?.name}</Text>
            <Text style={{ color: theme.accent, fontWeight: '700' }}>
              See who’s open · {current.checkIn ? timeLeft(current.checkIn.expiresAt) : ''}
            </Text>
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {locationError ? <Text style={{ color: theme.danger }}>{locationError}</Text> : null}

        {loading && !venues.length ? <Skeleton theme={theme} /> : null}

        {!loading && venues.length === 0 ? (
          <EmptyState
            theme={theme}
            title="No venues nearby"
            body="We couldn't find a place around you. Try again, or pick a nearby candidate."
            action={{ label: 'Retry', onPress: load }}
          />
        ) : (
          venues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              theme={theme}
              distance={
                coords && venue.latitude != null && venue.longitude != null
                  ? distanceBetween(coords.latitude, coords.longitude, venue.latitude, venue.longitude)
                  : undefined
              }
              onPress={() => checkIn(venue)}
            />
          ))
        )}

        <View style={{ height: 12 }} />
        <PrimaryButton title="Refresh location" theme={theme} variant="ghost" onPress={load} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120 },
  wordmark: { fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 18, marginTop: 6 },
  here: { borderRadius: 20, padding: 18, marginBottom: 18, gap: 4 },
  hereName: { fontSize: 22, fontWeight: '800' },
});
