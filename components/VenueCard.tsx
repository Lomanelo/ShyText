import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Venue } from '../types/venue';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { formatDistance } from '../utils/geo';

export function activityLabel(count = 0) {
  if (count >= 1) {
    return { label: `${count} ${count === 1 ? 'ShyText' : 'ShyTexts'}`, live: true };
  }
  return { label: 'Quiet', live: false };
}

export function VenueCard({
  venue,
  distance,
  theme,
  onPress,
}: {
  venue: Venue;
  distance?: number;
  theme: Theme;
  onPress: () => void;
}) {
  const activity = activityLabel(venue.activeCount);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${venue.name}`}
      style={({ pressed }) => [
        styles.card,
        cardShadow(theme),
        { backgroundColor: theme.card, transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.title, { color: theme.text }]}>{venue.name}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>
            {distance != null ? formatDistance(distance) : venue.address || venue.category}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: activity.live ? theme.accentSoft : theme.bg }]}>
          <Text style={[type.caption, { color: activity.live ? theme.accent : theme.quiet, fontWeight: '700' }]}>
            {activity.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[16],
    borderRadius: radius.lg,
    gap: space[16],
    marginBottom: space[12],
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
});
