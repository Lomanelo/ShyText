import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { VenueCard } from '../../components/VenueCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { radius, space, type, useTheme } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { candidateListKey, getPlacesProvider, isPlacesConfigured } from '../../services/places';
import { countActiveShyTexts, listMyActiveShyTexts } from '../../services/shytexts';
import { ensureInternalVenue, findVenuesByProviderPlaceIds, getVenue, toVenue } from '../../services/venues';
import { PlacesRequestError, Venue, VenueCandidate } from '../../types/venue';
import { ShyTextPost } from '../../types/shytext';
import { distanceBetween, NEARBY_RADIUS_METERS, pickClosest, PRECISE_ACCURACY_METERS } from '../../utils/geo';
import { remainingCompact } from '../../utils/dates';
import { auth } from '../../services/firebase';

async function hydrate(candidates: VenueCandidate[]): Promise<Venue[]> {
  const existing = await findVenuesByProviderPlaceIds(candidates.map((item) => item.providerPlaceId));
  return candidates.map((candidate) => toVenue(candidate, existing.get(candidate.providerPlaceId)?.id));
}

async function attachCounts(venues: Venue[]): Promise<Venue[]> {
  return Promise.all(
    venues.map(async (venue) => {
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
    async (search?: string, relock = false) => {
      setLoading(true);
      setError(null);
      setRateLimited(false);
      try {
        const next = await refresh(relock);
        if (!next) {
          setLoading(false);
          return;
        }
        const provider = getPlacesProvider();
        let candidates: VenueCandidate[] = [];
        try {
          candidates = search?.trim()
            ? (await provider.searchVenues?.(search.trim(), next.latitude, next.longitude)) ?? []
            : await provider.getNearbyVenues(next.latitude, next.longitude);
        } catch (err) {
          if (err instanceof PlacesRequestError && err.status === 429) {
            setRateLimited(true);
            setError(err.message);
          } else {
            throw err;
          }
        }
        const listed = pickClosest(
          (await hydrate(candidates)).map((venue) => ({
            ...venue,
            distanceMeters:
              venue.latitude != null && venue.longitude != null
                ? distanceBetween(next.latitude, next.longitude, venue.latitude, venue.longitude)
                : venue.distanceMeters ?? 9999,
          }))
        );
        setVenues(listed);
        setLoading(false);
        void attachCounts(listed).then(setVenues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load venues.');
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

  if (!coords && status !== 'granted' && !venues.length) {
    return (
      <Screen theme={theme} inset={false}>
        <LocationPermission theme={theme} error={locationError} busy={busy} onAllow={() => load()} />
      </Screen>
    );
  }

  const fuzzy = accuracy != null && accuracy > PRECISE_ACCURACY_METERS;
  const placesReady = isPlacesConfigured();

  return (
      <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(query || undefined, true)} tintColor={theme.accent} />}
      >
        <Text style={[type.body, { color: theme.muted, marginBottom: space[16] }]}>
          The five closest places within {NEARBY_RADIUS_METERS} m. You stay private until you drop a ShyText.
        </Text>

        {visibleAt ? (
          <Pressable
            onPress={() => router.push(`/venue/${visibleAt.post.venueId}`)}
            style={[styles.here, { backgroundColor: theme.accentSoft }]}
          >
            <Text style={[type.caption, { color: theme.muted }]}>You’re visible at</Text>
            <Text style={[type.headline, { color: theme.text }]}>{visibleAt.name}</Text>
            <Text style={[type.caption, { color: theme.accent, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
              ShyText · {remainingCompact(visibleAt.post.expiresAt)}
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text selectable style={[type.body, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}
        {locationError ? (
          <Text selectable style={[type.body, { color: theme.danger }]}>
            {locationError}
          </Text>
        ) : null}
        {fuzzy ? (
          <Text style={[type.caption, { color: theme.muted, marginBottom: space[12] }]}>
            GPS is about ±{Math.round(accuracy ?? 0)} m. Distances update as the fix tightens.
          </Text>
        ) : null}

        {loading && !venues.length ? <Skeleton theme={theme} /> : null}

        {!loading && venues.length === 0 ? (
          <EmptyState
            theme={theme}
            icon="location-outline"
            title={rateLimited ? 'Try again in a moment' : placesReady ? 'Nothing within 100 m' : 'Venue search isn’t connected'}
            body={
              rateLimited
                ? 'Apple Maps asked us to slow down. Pull to refresh shortly.'
                : placesReady
                  ? 'No social place is within 100 meters. Move closer to a café, bar, or park, then pull to refresh.'
                  : 'Add EXPO_PUBLIC_PLACES_PROXY_URL to your .env (your Netlify /api/places URL) and reload.'
            }
            action={{
              label: rateLimited ? 'Retry' : placesReady ? 'Search places' : 'Retry',
              onPress: rateLimited || !placesReady ? () => load() : () => setSearchOpen(true),
            }}
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
            <Text style={[type.headline, { color: theme.accent }]}>Can’t find where you are? Search places</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[16], paddingBottom: space[32] },
  here: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space[16], marginBottom: space[16], gap: 4 },
  search: { borderRadius: radius.md, borderCurve: 'continuous', padding: space[16], minHeight: 52, fontSize: 17 },
  searchLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
