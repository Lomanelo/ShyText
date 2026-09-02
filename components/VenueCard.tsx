import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Venue } from '../types/venue';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { formatDistance } from '../utils/geo';
import { buildVenueImageUrl } from '../services/venueImage';
import { rememberVenueImage } from '../services/venueImageCache';
import { VenueStamp } from './VenueStamp';
import { LiveDots } from './LiveDots';
import { PressScale } from './PressScale';
import { ShyInFlame } from './shy-in-flame';
import { useTranslation } from 'react-i18next';

export function VenueCard({
  venue,
  distance,
  theme,
  onPress,
  onShyIn,
  lit = false,
  shyInLoading = false,
}: {
  venue: Venue;
  distance?: number;
  theme: Theme;
  index?: number;
  onPress: () => void;
  onShyIn?: () => void | Promise<void>;
  lit?: boolean;
  shyInLoading?: boolean;
}) {
  const { t } = useTranslation();
  const live = (venue.activeCount ?? 0) >= 1;
  const meters = distance ?? venue.distanceMeters;
  const howFar = formatDistance(meters);
  // Same size as venue hero proxy fallback so URLs match when imageUrl is absent.
  const imageUrl = buildVenueImageUrl(venue);
  const meta = [howFar, venue.category].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!imageUrl) return;
    rememberVenueImage([venue.id, venue.providerPlaceId], imageUrl);
    void Image.prefetch(imageUrl);
  }, [imageUrl, venue.id, venue.providerPlaceId]);

  return (
    <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
      <PressScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('venue.openA11y', {
          name: venue.name,
          distance: howFar ? `, ${howFar}` : '',
          live: live ? t('venue.liveCount', { count: venue.activeCount }) : '',
        })}
        style={styles.head}
      >
        <View style={styles.thumb}>
          <VenueStamp category={venue.category} height={88} imageUrl={imageUrl} />
        </View>
        <View style={styles.copy}>
          <Text style={[type.headline, { color: theme.text }]} numberOfLines={2}>
            {venue.name}
          </Text>
          {meta ? (
            <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {live ? <LiveDots count={venue.activeCount ?? 0} color={theme.accent} /> : null}
        </View>
      </PressScale>

      <View style={styles.slide}>
        <ShyInFlame
          variant="inline"
          venueName={venue.name}
          theme={theme}
          lit={lit}
          loading={shyInLoading}
          onShyIn={lit ? undefined : onShyIn}
          onPress={lit ? onPress : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: space[12],
    gap: space[12],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  slide: {
    width: '100%',
  },
});
