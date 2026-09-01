import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Venue } from '../types/venue';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { formatDistance } from '../utils/geo';
import { springLayout } from '../hooks/usePressScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { buildVenueImageUrl } from '../services/venueImage';
import { VenueStamp } from './VenueStamp';
import { LiveDots } from './LiveDots';
import { PressScale } from './PressScale';
import { useTranslation } from 'react-i18next';

export function VenueCard({
  venue,
  distance,
  theme,
  onPress,
}: {
  venue: Venue;
  distance?: number;
  theme: Theme;
  index?: number;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const { t } = useTranslation();
  const live = (venue.activeCount ?? 0) >= 1;
  const meters = distance ?? venue.distanceMeters;
  const howFar = formatDistance(meters);
  const imageUrl = buildVenueImageUrl(venue, { width: 640, height: 360 });

  return (
    <Animated.View layout={reduce ? undefined : springLayout()}>
      <PressScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('venue.openA11y', {
          name: venue.name,
          distance: howFar ? `, ${howFar}` : '',
          live: live ? t('venue.liveCount', { count: venue.activeCount }) : '',
        })}
        style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}
      >
        <VenueStamp category={venue.category} height={152} imageUrl={imageUrl}>
          {howFar ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{howFar}</Text>
            </View>
          ) : null}
        </VenueStamp>
        <View style={styles.caption}>
          <Text style={[type.title, { color: theme.text, flex: 1 }]} numberOfLines={2}>
            {venue.name}
          </Text>
          {live ? <LiveDots count={venue.activeCount ?? 0} color={theme.accent} /> : null}
        </View>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  chip: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: '#FFF4EA',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    paddingHorizontal: space[16],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    minHeight: 56,
  },
});
