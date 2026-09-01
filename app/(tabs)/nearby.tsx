import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { VenueCard } from '../../components/VenueCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { HintBanner } from '../../components/HintBanner';
import { CountdownBadge } from '../../components/CountdownBadge';
import { ShyInFlame } from '../../components/shy-in-flame';
import { cardShadow, radius, space, type, useTheme } from '../../theme';
import { springLayout } from '../../hooks/usePressScale';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { candidateListKey, getPlacesProvider, isPlacesConfigured } from '../../services/places';
import {
  countActiveCheckIns,
  ensureInternalVenue,
  findVenuesByProviderPlaceIds,
  getVenue,
  toVenue,
} from '../../services/venues';
import { CheckIn, PlacesRequestError, Venue, VenueCandidate } from '../../types/venue';
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
      const countable = !venue.id.startsWith('apple:') && !venue.id.startsWith('pending:');
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
        venue.latitude != null && venue.longitude != null
          ? distanceBetween(latitude, longitude, venue.latitude, venue.longitude)
          : venue.distanceMeters ?? 9999,
    }))
  );
}

export default function NearbyScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { coords, status, error: locationError, busy, refresh } = useLocation();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [pool, setPool] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleAt, setVisibleAt] = useState<{ checkIn: CheckIn; venue: Venue } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [shyInHint, setShyInHint] = useState(false);

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
        setPool(listed);
        setVenues(listed);
        setLoading(false);
        void attachCounts(listed)
          .then((withCounts) => {
            setPool(withCounts);
            setVenues(rankVenues(withCounts, next.latitude, next.longitude));
          })
          .catch(() => undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.couldNotLoadVenues'));
        setLoading(false);
      }
    },
    [refresh]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    AsyncStorage.getItem(SHY_IN_HINT_KEY).then((seen) => {
      if (!seen) setShyInHint(true);
    });
  }, []);

  useEffect(() => {
    if (!coords || pool.length === 0) return;
    const next = rankVenues(pool, coords.latitude, coords.longitude);
    setVenues((prev) => {
      if (
        prev.length === next.length &&
        prev.every((venue, index) => venue.id === next[index]?.id && venue.distanceMeters === next[index]?.distanceMeters)
      ) {
        return prev;
      }
      return next;
    });
  }, [coords, pool]);

  useEffect(() => {
    const live = current.checkIn && !current.expired ? current.checkIn : null;
    if (!live) {
      setVisibleAt(null);
      return;
    }
    let cancelled = false;
    getVenue(live.venueId).then((found) => {
      if (cancelled) return;
      setVisibleAt({
        checkIn: live,
        venue: found ?? {
          id: live.venueId,
          provider: 'apple',
          providerPlaceId: live.venueId,
          name: t('nearby.aVenue'),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [current.checkIn, current.expired]);

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
    if (checkingIn) return;
    try {
      setCheckingIn(true);
      setError(null);
      const internal = await ensureInternalVenue(venue);
      if (current.checkIn && !current.expired && current.checkIn.venueId === internal.id) {
        await current.rememberVenue(internal);
        router.push(`/venue/${internal.id}`);
        return;
      }
      if (!profile) {
        setError(t('errors.finishProfile'));
        return;
      }
      const next = await refresh();
      await current.checkInHere(internal, next?.latitude, next?.longitude, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        age: profile.age,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotCheckIn'));
    } finally {
      setCheckingIn(false);
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
  const closest = !query.trim() && !visibleAt ? venues[0] : undefined;

  return (
      <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={[styles.content, closest ? styles.contentWithDock : null]}
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
          <Animated.View layout={reduce ? undefined : springLayout()}>
            <HintBanner
              theme={theme}
              title={t('nearby.flickHint')}
              onDismiss={() => {
                setShyInHint(false);
                void AsyncStorage.setItem(SHY_IN_HINT_KEY, '1');
              }}
            />
          </Animated.View>
        ) : null}

        <Animated.View layout={reduce ? undefined : springLayout()}>
          {visibleAt ? (
            <View style={[styles.here, { backgroundColor: theme.card }, cardShadow(theme)]}>
              <ShyInFlame
                lit
                size={64}
                venueName={visibleAt.venue.name}
                theme={theme}
                onPress={() => router.push(`/venue/${visibleAt.venue.id}`)}
                onShyOut={() => void current.leave()}
                accessory={<CountdownBadge expiresAt={visibleAt.checkIn.expiresAt} theme={theme} />}
              />
            </View>
          ) : null}
        </Animated.View>

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
      </ScrollView>
      {closest ? (
        <View style={[styles.dock, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ShyInFlame
            venueName={closest.name}
            theme={theme}
            loading={checkingIn}
            onShyIn={() => checkInAtVenue(closest)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[16], paddingBottom: space[32], gap: space[12] },
  contentWithDock: { paddingBottom: 180 },
  here: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingVertical: space[16],
    paddingHorizontal: space[12],
    alignItems: 'center',
  },
  dock: { paddingHorizontal: space[16], paddingTop: space[8] },
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
