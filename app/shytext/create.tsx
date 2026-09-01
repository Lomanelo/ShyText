import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { useLocation } from '../../hooks/useLocation';
import { getVenue } from '../../services/venues';
import { useTranslation } from 'react-i18next';

export default function CheckInScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  const { profile } = useAuth();
  const current = useCurrentVenue();
  const { refresh } = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const venue = current.venue?.id === venueId ? current.venue : await getVenue(venueId);
        if (!venue || cancelled) return;
        if (current.checkIn && !current.expired && current.checkIn.venueId === venue.id) {
          router.replace(`/venue/${venue.id}`);
          return;
        }
        const coords = await refresh();
        await current.checkInHere(venue, coords?.latitude, coords?.longitude, {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          age: profile.age,
        });
        if (!cancelled) router.replace(`/venue/${venue.id}`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('errors.couldNotCheckIn'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [venueId, profile]);

  return (
    <Screen theme={theme} inset={false}>
      <Stack.Screen options={{ title: t('common.checkIn') }} />
      <Text style={[type.body, { padding: 20, color: error ? theme.danger : theme.muted }]}>
        {error ?? t('common.checkingIn')}
      </Text>
    </Screen>
  );
}
