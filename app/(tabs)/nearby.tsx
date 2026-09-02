import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { VenueCard } from '../../components/VenueCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { HintBanner } from '../../components/HintBanner';
import { radius, space, type, useTheme } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { candidateListKey, getPlacesProvider, isPlacesConfigured } from '../../services/places';
import {
  countActiveCheckIns,
  ensureInternalVenue,
  findVenuesByProviderPlaceIds,
  toVenue,
} from '../../services/venues';
import { PlacesRequestError, Venue, VenueCandidate } from '../../types/venue';
import { distanceBetween, pickClosest } from '../../utils/geo';
import { useTranslation } from 'react-i18next';

const SHY_IN_HINT_KEY = 'shytext.hint.shyIn';

async function hydrate(candidates: VenueCandidate[]): Promise<Venue[]> {
  const existing = await findVenuesByProviderPlaceIds(candidates.map((item) => item.providerPlaceId));
  return candidates.map((candidate) => toVenue(candidate, existing.get(candidate.providerPlaceId)?.id));
}

async function attachCounts(venues: Venue[]): Promise<Venue[]> {
  return Promise.all(
    venues.map(async (venue) => {
      const countable =
        !venue.id.startsWith('apple:') &&
        !venue.id.startsWith('google:') &&
        !venue.id.startsWith('serper:') &&
        !venue.id.startsWith('pending:');
      return {
        ...venue,
        activeCount: countable ? await countActiveCheckIns(venue.id) : 0,
      };
    })
  );
}

function rankVenues(venues: Venue[], latitude: number, longitude: number) {
  return pickClosest(
    venues.map((venue) => ({
      ...venue,
      distanceMeters:
        venue.distanceMeters ??
        (venue.latitude != null && venue.longitude != null
          ? distanceBetween(latitude, longitude, venue.latitude, venue.longitude)
          : 9999),
    }))
  );
}

export default function NearbyScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { coords, status, error: locationError, busy, refresh } = useLocation();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [query, setQuery] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [shyInHint, setShyInHint] = useState(false);

  const liveCheckIn = current.checkIn && !current.expired ? current.checkIn : null;
  const liveVenue = liveCheckIn ? current.venue : null;

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
        const listed = rankVenues(await hydrate(candidates), next.latitude, next.longitude);
        setVenues(listed);
        setLoading(false);
        void attachCounts(listed)
          .then((withCounts) => {
            setVenues(rankVenues(withCounts, next.latitude, next.longitude));
          })
          .catch(() => undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.couldNotLoadVenues'));
        setLoading(false);
      }
    },
    [refresh, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    AsyncStorage.getItem(SHY_IN_HINT_KEY).then((seen) => {
      if (!seen) setShyInHint(true);
    });
  }, []);

  const openVenue = async (venue: Venue) => {
    try {
      const internal = await ensureInternalVenue(venue);
      await current.rememberVenue(internal);
      router.push(`/venue/${internal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotOpenVenue'));
    }
  };

  const checkInAtVenue = async (venue: Venue) => {
    if (checkingInId) return;
    const key = candidateListKey(venue);
    try {
      setCheckingInId(key);
      setError(null);
      const internal = await ensureInternalVenue(venue);
      await current.rememberVenue(internal);

      if (current.checkIn && !current.expired && current.checkIn.venueId === internal.id) {
        router.push(`/venue/${internal.id}`);
        return;
      }
      if (!profile) {
        setError(t('errors.finishProfile'));
        return;
      }

      // Open the venue immediately; finish Shyne with the last known fix (no GPS wait).
      router.push(`/venue/${internal.id}`);
      void current
        .checkInHere(internal, coords?.latitude, coords?.longitude, {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          age: profile.age,
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t('errors.couldNotCheckIn'));
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotCheckIn'));
    } finally {
      setCheckingInId(null);
    }
  };

  if (!coords && status !== 'granted' && !venues.length) {
    return (
      <Screen theme={theme} inset={false}>
        <LocationPermission theme={theme} error={locationError} busy={busy} onAllow={() => load()} />
      </Screen>
    );
  }

  const placesReady = isPlacesConfigured();

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(query || undefined, true)} tintColor={theme.accent} />}
      >
        <View style={[styles.searchWrap, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={18} color={theme.quiet} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('nearby.searchPlaceholder')}
            placeholderTextColor={theme.quiet}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance="default"
            onSubmitEditing={() => load(query)}
            style={[styles.search, { color: theme.text }]}
          />
          {query.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.search')}
              onPress={() => load(query)}
              hitSlop={8}
              style={styles.searchGo}
            >
              <Ionicons name="arrow-forward-circle" size={24} color={theme.accent} />
            </Pressable>
          ) : null}
        </View>

        {shyInHint && venues.length > 0 ? (
          <HintBanner
            theme={theme}
            title={t('nearby.flickHint')}
            onDismiss={() => {
              setShyInHint(false);
              void AsyncStorage.setItem(SHY_IN_HINT_KEY, '1');
            }}
          />
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

        {loading && !venues.length ? <Skeleton theme={theme} /> : null}

        {!loading && venues.length === 0 ? (
          <EmptyState
            theme={theme}
            icon="location-outline"
            title={rateLimited ? t('nearby.rateLimitedTitle') : placesReady ? t('nearby.emptyTitle') : t('nearby.searchOffline')}
            body={
              rateLimited
                ? t('nearby.rateLimitedBody')
                : placesReady
                  ? t('nearby.emptyBody')
                  : undefined
            }
            action={
              rateLimited || !placesReady
                ? { label: t('common.retry'), onPress: () => load(query || undefined, true) }
                : undefined
            }
          />
        ) : (
          venues.map((venue) => {
            const key = candidateListKey(venue);
            const isHere =
              checkingInId === key ||
              (!!liveCheckIn &&
                (venue.id === liveCheckIn.venueId ||
                  (!!liveVenue &&
                    (liveVenue.id === venue.id || liveVenue.providerPlaceId === venue.providerPlaceId))));
            return (
              <VenueCard
                key={key}
                venue={venue}
                theme={theme}
                distance={venue.distanceMeters}
                lit={isHere}
                shyInLoading={checkingInId === key && !isHere}
                onPress={() => openVenue(venue)}
                onShyIn={isHere ? undefined : () => checkInAtVenue(venue)}
              />
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[16], paddingBottom: space[32], gap: space[12] },
  searchWrap: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    minHeight: 48,
    paddingLeft: space[16],
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  search: { flex: 1, minHeight: 48, fontSize: 17 },
  searchGo: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
