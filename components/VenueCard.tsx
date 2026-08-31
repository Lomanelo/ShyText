import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Venue } from '../types/venue';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { formatDistance } from '../utils/geo';
import { springLayout } from '../hooks/usePressScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { VenueStamp } from './VenueStamp';
import { LiveDots } from './LiveDots';
import { PressScale } from './PressScale';

export function VenueCard({
  venue,
  distance,
  theme,
  onPress,
  onCheckIn,
}: {
  venue: Venue;
  distance?: number;
  theme: Theme;
  index?: number;
  onPress: () => void;
  onCheckIn?: () => void;
}) {
  const reduce = useReduceMotion();
  const live = (venue.activeCount ?? 0) >= 1;
  const meters = distance ?? venue.distanceMeters;
  const howFar = formatDistance(meters);

  return (
    <Animated.View layout={reduce ? undefined : springLayout()}>
      <PressScale
        onPress={onPress}
        onLongPress={
          onCheckIn
            ? () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onCheckIn();
              }
            : undefined
        }
        delayLongPress={380}
        accessibilityRole="button"
        accessibilityLabel={`Open ${venue.name}${howFar ? `, ${howFar}` : ''}${live ? `, ${venue.activeCount} live` : ''}${onCheckIn ? '. Hold to check in' : ''}`}
        style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}
      >
        <VenueStamp category={venue.category} height={152}>
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
