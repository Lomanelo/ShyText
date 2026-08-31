import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { VenueCard } from '../../components/VenueCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Wordmark } from '../../components/wordmark';
import { radius, space, type, useTheme } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { candidateListKey, demoCandidates, getPlacesProvider } from '../../services/places';
import { countActiveShyTexts, listMyActiveShyTexts } from '../../services/shytexts';
import { ensureInternalVenue, findVenuesByProviderPlaceIds, getVenue, toVenue } from '../../services/venues';
import { PlacesRequestError, Venue, VenueCandidate } from '../../types/venue';
import { ShyTextPost } from '../../types/shytext';
import { distanceBetween } from '../../utils/geo';
import { isDevToolsEnabled } from '../../utils/config';
import { remainingCompact } from '../../utils/dates';
import { auth } from '../../services/firebase';

async function hydrate(candidates: VenueCandidate[]): Promise<Venue[]> {
  const existing = await findVenuesByProviderPlaceIds(candidates.map((item) => item.providerPlaceId));
  return Promise.all(
    candidates.map(async (candidate) => {
      const venue = toVenue(candidate, existing.get(candidate.providerPlaceId)?.id);
      const countable = !venue.id.startsWith('apple:') && !venue.id.startsWith('pending:');
      return {
        ...venue,
        activeCount: countable ? await countActiveShyTexts(venue.id) : 0,
      };
    })
  );
}

export default function NearbyScreen() {
  const theme = useTheme();
  const { coords, status, error: locationError, busy, accuracy, refresh } = useLocation();
  const current = useCurrentVenue();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleAt, setVisibleAt] = useState<{ post: ShyTextPost; name: string } | null>(null);

  const load = useCallback(
    async (search?: string) => {
      setLoading(true);
      setError(null);
      setRateLimited(false);
      try {
        const next = await refresh();
        if (!next && !isDevToolsEnabled()) {
          setLoading(false);
          return;
        }
        const lat = next?.latitude ?? 48.853;
        const lon = next?.longitude ?? 2.35;
        const provider = getPlacesProvider();
        let candidates: VenueCandidate[] = [];
        try {
          candidates = search?.trim()
            ? (await provider.searchVenues?.(search.trim(), lat, lon)) ?? []
            : await provider.getNearbyVenues(lat, lon);
        } catch (err) {
          if (err instanceof PlacesRequestError && err.status === 429) {
            setRateLimited(true);
            setError(err.message);
          } else if (isDevToolsEnabled()) {
            candidates = [];
          } else {
            throw err;
          }
        }
        if (isDevToolsEnabled() && !search?.trim()) {
          const demo = await demoCandidates(lat, lon);
          const seen = new Set(candidates.map((item) => item.providerPlaceId));
          candidates = [...demo.filter((item) => !seen.has(item.providerPlaceId)), ...candidates];
        }
        setVenues(await hydrate(candidates));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load venues.');
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setVisibleAt(null);
        return;
      }
      let cancelled = false;
      (async () => {
        const live = await listMyActiveShyTexts(uid);
        const post = live[0];
        if (!post) {
          if (!cancelled) setVisibleAt(null);
          return;
        }
        const found = await getVenue(post.venueId);
        if (!cancelled) setVisibleAt({ post, name: found?.name ?? 'a venue' });
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const openVenue = async (venue: Venue) => {
    try {
      const next = await refresh();
      const internal = await ensureInternalVenue(venue);
      try {
        await current.checkInHere(internal, next?.latitude, next?.longitude);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (
          !message.includes('Move closer') &&
          !message.includes('pick another') &&
          !message.includes('Location is needed')
        ) {
          throw err;
        }
        await current.rememberVenue(internal);
      }
      router.push(`/venue/${internal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this venue.');
    }
  };

  if (!coords && status !== 'granted' && !venues.length && !isDevToolsEnabled()) {
    return (
      <Screen theme={theme}>
        <LocationPermission theme={theme} error={locationError} busy={busy} onAllow={() => load()} />
      </Screen>
    );
  }

  const fuzzy = accuracy != null && accuracy > 150;

  return (
    <Screen theme={theme}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={theme.accent} />}
      >
        <Wordmark theme={theme} />
        <Text style={[type.display, { color: theme.text, marginBottom: space[8], marginTop: space[12] }]}>
          Where are you?
        </Text>
        <Text style={[type.body, { color: theme.muted, marginBottom: space[16] }]}>
          GPS can be a bit off. Pick the place that matches.
        </Text>

        {visibleAt ? (
          <Pressable
            onPress={() => router.push(`/venue/${visibleAt.post.venueId}`)}
            style={[styles.here, { backgroundColor: theme.accentSoft }]}
          >
            <Text style={[type.caption, { color: theme.muted }]}>You’re visible at</Text>
            <Text style={[type.title, { color: theme.text }]}>{visibleAt.name}</Text>
            <Text style={[type.caption, { color: theme.accent, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
              ShyText · {remainingCompact(visibleAt.post.expiresAt)}
            </Text>
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {locationError ? <Text style={{ color: theme.danger }}>{locationError}</Text> : null}
        {fuzzy ? (
          <Text style={{ color: theme.muted }}>Location is a bit fuzzy. Choose the matching place below.</Text>
        ) : null}

        {loading && !venues.length ? <Skeleton theme={theme} /> : null}

        {!loading && venues.length === 0 ? (
          <EmptyState
            theme={theme}
            icon="location-outline"
            title={rateLimited ? 'Try again in a moment' : 'No venues nearby'}
            body={
              rateLimited
                ? 'Apple Maps asked us to slow down. Pull to refresh shortly.'
                : "We couldn't find a social place around you. Search by name, or pull to refresh."
            }
            action={{ label: rateLimited ? 'Retry' : 'Search places', onPress: rateLimited ? () => load() : () => setSearchOpen(true) }}
          />
        ) : (
          venues.map((venue) => (
            <VenueCard
              key={candidateListKey(venue)}
              venue={venue}
              theme={theme}
              distance={
                coords && venue.latitude != null && venue.longitude != null
                  ? distanceBetween(coords.latitude, coords.longitude, venue.latitude, venue.longitude)
                  : venue.distanceMeters
              }
              onPress={() => openVenue(venue)}
            />
          ))
        )}

        <View style={{ height: space[16] }} />
        {searchOpen ? (
          <View style={{ gap: space[8] }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Café, bar, park…"
              placeholderTextColor={theme.quiet}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => load(query)}
              style={[styles.search, { color: theme.text, backgroundColor: theme.card }]}
            />
            <PrimaryButton title="Search places" theme={theme} loading={loading} onPress={() => load(query)} />
          </View>
        ) : (
          <Pressable onPress={() => setSearchOpen(true)} style={styles.searchLink}>
            <Text style={{ color: theme.accent, fontWeight: '700' }}>Can't find where you are? Search places</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[16], paddingBottom: 120 },
  here: { borderRadius: radius.lg, padding: space[16], marginBottom: space[16], gap: 4 },
  search: { borderRadius: radius.md, padding: space[16], minHeight: 52, fontSize: 16 },
  searchLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
