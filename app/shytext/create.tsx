import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useLocation } from '../../hooks/useLocation';
import { resolveCheckInVenue } from '../../services/checkInTarget';
import { ensureInternalVenue } from '../../services/venues';
import { useTranslation } from 'react-i18next';

export default function CheckInScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { venueId, closest, name } = useLocalSearchParams<{
    venueId?: string;
    closest?: string;
    name?: string;
  }>();
  const { user, profile, loading: authLoading, hasProfile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const [error, setError] = useState<string | null>(null);
  const named = typeof name === 'string' ? name : Array.isArray(name) ? name[0] : undefined;
  const targetId = typeof venueId === 'string' ? venueId : Array.isArray(venueId) ? venueId[0] : undefined;
  const wantClosest = closest === '1' || closest === 'true';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/(auth)/welcome');
      return;
    }
    if (!hasProfile) {
      router.replace('/(auth)/profile-setup');
      return;
    }
    if (!profile) return;
    if (!targetId && !wantClosest && !named?.trim()) {
      setError(t('errors.siriNoNearby'));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const coords = await refresh();
        if (!coords) throw new Error(t('location.needed'));
        const venue = await resolveCheckInVenue({
          venueId: targetId,
          name: named,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (cancelled) return;
        const internal = await ensureInternalVenue(venue);
        if (current.checkIn && !current.expired && current.checkIn.venueId === internal.id) {
          router.replace(`/venue/${internal.id}`);
          return;
        }
        await current.checkInHere(internal, coords.latitude, coords.longitude, {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          age: profile.age,
        });
        if (!cancelled) router.replace(`/venue/${internal.id}`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('errors.couldNotCheckIn'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, hasProfile, profile, targetId, wantClosest, named]);

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen options={{ title: t('common.checkIn') }} />
      <Text style={[type.body, { padding: 20, color: error ? theme.danger : theme.muted }]}>
        {error ?? t('common.checkingIn')}
      </Text>
    </Screen>
  );
}
